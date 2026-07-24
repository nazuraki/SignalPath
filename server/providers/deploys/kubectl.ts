import { spawn } from 'node:child_process';
import type { DeployServiceConfig, KubectlConfig, ReleasePhase } from '../../../shared/types.ts';

const TIMEOUT_MS = 10_000;

function buildArgs(
  name: string,
  namespace: string,
  resourceType: DeployServiceConfig['kubectlResourceType'],
  context: string | undefined,
): { args: string[] } {
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
    return { args };
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
  return { args };
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
  const { args } = buildArgs(name, namespace, resourceType, cfg?.context);

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        proc.kill();
        resolve('unreachable');
      }
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
      resolve('unreachable');
    });

    proc.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      const combined = (stdout + stderr).toLowerCase();

      if (
        combined.includes('unable to connect') ||
        combined.includes('connection refused') ||
        combined.includes('etimedout') ||
        combined.includes('no such host') ||
        combined.includes('dial tcp')
      ) {
        resolve('unreachable');
        return;
      }

      if (code === 0) {
        resolve('complete');
        return;
      }

      // "Waiting for rollout to finish" → still in progress
      if (combined.includes('waiting for')) {
        resolve('running');
        return;
      }

      resolve('failed');
    });
  });
}
