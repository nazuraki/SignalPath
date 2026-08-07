import { spawn } from 'node:child_process';
import type {
  DeployServiceConfig,
  KubectlConfig,
  ReleasePhase,
  RolloutPercentSource,
  RolloutProgress,
} from '../../../shared/types.ts';

const TIMEOUT_MS = 10_000;

/** Connection failures that mean "cluster not reachable" rather than "rollout failed". */
const UNREACHABLE_MARKERS = [
  'unable to connect',
  'connection refused',
  'etimedout',
  'no such host',
  'dial tcp',
];

interface KubectlResult {
  code: number | null;
  stdout: string;
  stderr: string;
  /** True when kubectl is missing, timed out, or the cluster was unreachable. */
  unreachable: boolean;
}

/**
 * Runs kubectl and captures its output, mapping spawn failures, timeouts, and
 * connection errors onto `unreachable` so callers can degrade gracefully when
 * VPN is down instead of reporting a failed release.
 */
function runKubectl(args: string[]): Promise<KubectlResult> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      proc.kill();
      resolve({ code: null, stdout, stderr, unreachable: true });
    }, TIMEOUT_MS + 2_000);

    const proc = spawn('kubectl', args);
    proc.stdout.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    proc.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });

    proc.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // kubectl not installed or not on PATH
      console.warn(`kubectl spawn error: ${err.message}`);
      resolve({ code: null, stdout, stderr, unreachable: true });
    });

    proc.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const combined = (stdout + stderr).toLowerCase();
      const unreachable = UNREACHABLE_MARKERS.some((m) => combined.includes(m));
      resolve({ code, stdout, stderr, unreachable });
    });
  });
}

function statusArgs(
  name: string,
  namespace: string,
  resourceType: DeployServiceConfig['kubectlResourceType'],
  context: string | undefined,
): string[] {
  if (resourceType === 'argo-rollout') {
    // Requires the kubectl-argo-rollouts plugin:
    // https://argoproj.github.io/argo-rollouts/installation/#kubectl-plugin
    const args = [
      'argo',
      'rollouts',
      'status',
      name,
      '-n',
      namespace,
      '--timeout',
      `${TIMEOUT_MS / 1000}s`,
    ];
    if (context) args.push('--context', context);
    return args;
  }
  // Standard Kubernetes Deployment
  const args = [
    'rollout',
    'status',
    `deployment/${name}`,
    '-n',
    namespace,
    `--timeout=${TIMEOUT_MS / 1000}s`,
  ];
  if (context) args.push('--context', context);
  return args;
}

/**
 * Shells out to kubectl (or kubectl argo rollouts) and maps the result to a ReleasePhase.
 * Returns 'unreachable' on connection errors so the dashboard degrades gracefully when VPN is down.
 */
export async function kubectlRolloutPhase(
  name: string,
  namespace: string,
  cfg: KubectlConfig | undefined,
  resourceType: DeployServiceConfig['kubectlResourceType'] = 'deployment',
): Promise<Extract<ReleasePhase, 'running' | 'complete' | 'failed' | 'unreachable'>> {
  const { code, stdout, stderr, unreachable } = await runKubectl(
    statusArgs(name, namespace, resourceType, cfg?.context),
  );
  if (unreachable) return 'unreachable';
  if (code === 0) return 'complete';
  // "Waiting for rollout to finish" → still in progress
  if ((stdout + stderr).toLowerCase().includes('waiting for')) return 'running';
  return 'failed';
}

// ---- Rollout progress -------------------------------------------------------

/**
 * The slice of the Argo Rollout / Deployment resource the progress read needs.
 * Everything is optional — a resource mid-reconcile carries almost no status,
 * and a plain Deployment has no canary block at all.
 */
interface RolloutDoc {
  spec?: {
    paused?: boolean;
    strategy?: { canary?: { steps?: Array<{ setWeight?: number }> } };
  };
  status?: {
    phase?: string;
    message?: string;
    currentStepIndex?: number;
    replicas?: number;
    updatedReplicas?: number;
    availableReplicas?: number;
    pauseConditions?: unknown[];
    canary?: { weights?: { canary?: { weight?: number }; stable?: { weight?: number } } };
  };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clampPct = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Derive a 0–100 rollout percentage, first rule wins:
 *
 *  1. A settled rollout is 100%. This has to come first: once a canary is fully
 *     promoted, Argo moves all traffic to stable and reports `canary.weight: 0` —
 *     the very same weight as a rollout that has not started. Reading rule 2
 *     first would show 0% for a completely healthy service.
 *  2. `status.canary.weights.canary.weight` — authoritative mid-rollout, when
 *     traffic routing is configured.
 *  3. `status.currentStepIndex`: past the last step means every step ran (100%),
 *     otherwise the nearest `setWeight` at or before the current step.
 *  4. `updatedReplicas / replicas` — also the only rule a plain Deployment hits.
 *
 * Returns a null percent rather than 0 when nothing applies, so the UI can render
 * "—" instead of implying the rollout hasn't started.
 */
export function derivePercent(doc: RolloutDoc): {
  percent: number | null;
  source: RolloutPercentSource | null;
} {
  const status = doc.status ?? {};
  const weights = status.canary?.weights;
  const { replicas, updatedReplicas } = status;
  const fullyUpdated = isNum(replicas) && replicas > 0 && replicas === updatedReplicas;

  // "Healthy" is Argo's fully-promoted-and-available phase; a stable weight of
  // 100 is the same fact read off the traffic split.
  if (fullyUpdated && (status.phase === 'Healthy' || weights?.stable?.weight === 100)) {
    return { percent: 100, source: 'stable' };
  }

  const canaryWeight = weights?.canary?.weight;
  if (isNum(canaryWeight) && canaryWeight > 0) {
    return { percent: clampPct(canaryWeight), source: 'canary-weight' };
  }

  const steps = doc.spec?.strategy?.canary?.steps;
  const idx = status.currentStepIndex;
  if (Array.isArray(steps) && steps.length > 0 && isNum(idx)) {
    if (idx >= steps.length) return { percent: 100, source: 'step-weight' };
    // Argo sets a weight and then advances the index, so the active weight is the
    // nearest setWeight at or before the current step (steps in between may be
    // pauses or analysis runs that carry no weight).
    for (let i = idx; i >= 0; i--) {
      const sw = steps[i]?.setWeight;
      if (isNum(sw)) return { percent: clampPct(sw), source: 'step-weight' };
    }
  }

  if (isNum(replicas) && replicas > 0 && isNum(updatedReplicas)) {
    return { percent: clampPct((updatedReplicas / replicas) * 100), source: 'replicas' };
  }

  return { percent: null, source: null };
}

/** Map a fetched resource document onto RolloutProgress. Pure, for testability. */
export function toRolloutProgress(doc: RolloutDoc): RolloutProgress {
  const status = doc.status ?? {};
  const steps = doc.spec?.strategy?.canary?.steps;
  const { percent, source } = derivePercent(doc);
  return {
    percent,
    source,
    argoPhase: status.phase,
    message: status.message,
    paused:
      doc.spec?.paused === true ||
      (Array.isArray(status.pauseConditions) && status.pauseConditions.length > 0),
    currentStepIndex: status.currentStepIndex,
    totalSteps: Array.isArray(steps) ? steps.length : undefined,
    replicas: status.replicas,
    updatedReplicas: status.updatedReplicas,
    availableReplicas: status.availableReplicas,
  };
}

/**
 * Reads the Rollout (or Deployment) resource as JSON and derives its progress.
 *
 * Uses plain `kubectl get -o json` rather than the argo-rollouts plugin: the raw
 * CRD carries the canary weights and step index, and this way the percentage
 * works without the plugin installed.
 */
export async function kubectlRolloutProgress(
  name: string,
  namespace: string,
  cfg: KubectlConfig | undefined,
  resourceType: DeployServiceConfig['kubectlResourceType'] = 'deployment',
): Promise<RolloutProgress> {
  const kind = resourceType === 'argo-rollout' ? 'rollout' : 'deployment';
  const args = ['get', kind, name, '-n', namespace, '-o', 'json'];
  if (cfg?.context) args.push('--context', cfg.context);

  const { code, stdout, stderr, unreachable } = await runKubectl(args);

  if (unreachable) {
    return {
      percent: null,
      source: null,
      error: 'cluster unreachable (VPN?)',
      unreachable: true,
    };
  }
  if (code !== 0) {
    const detail = (stderr || stdout).trim().split('\n')[0] || `kubectl exited ${code}`;
    return { percent: null, source: null, error: detail };
  }

  let doc: RolloutDoc;
  try {
    doc = JSON.parse(stdout) as RolloutDoc;
  } catch {
    return { percent: null, source: null, error: 'could not parse kubectl JSON output' };
  }
  return toRolloutProgress(doc);
}
