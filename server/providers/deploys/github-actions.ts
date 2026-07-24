import type {
  DeployServiceConfig,
  GitHubActionsDeployConfig,
  KubectlConfig,
  ReleasePhase,
  ReleaseStatus,
} from '../../../shared/types.ts';
import type { DeployProvider } from '../types.ts';
import { kubectlRolloutPhase } from './kubectl.ts';

interface GHARun {
  id: number;
  status: string; // "queued" | "in_progress" | "completed"
  conclusion: string | null; // "success" | "failure" | "cancelled" | null
  html_url: string;
  run_started_at: string;
  updated_at: string;
}

interface GHARunsResponse {
  workflow_runs: GHARun[];
}

export class GitHubActionsDeployProvider implements DeployProvider {
  readonly name = 'github-actions';

  private readonly token: string;
  private readonly kubectlCfg: KubectlConfig | undefined;
  private readonly services: Record<string, DeployServiceConfig>;

  constructor(
    cfg: GitHubActionsDeployConfig,
    services: Record<string, DeployServiceConfig>,
    kubectlCfg: KubectlConfig | undefined,
  ) {
    this.token = cfg.token;
    this.services = services;
    this.kubectlCfg = kubectlCfg;
  }

  private async ghGet<T>(path: string): Promise<T> {
    const r = await fetch(`https://api.github.com${path}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!r.ok) {
      const body = (await r.text()).slice(0, 300);
      throw new Error(`GitHub ${r.status} ${path}: ${body}`);
    }
    return (await r.json()) as T;
  }

  async getReleaseStatus(svcKey: string): Promise<ReleaseStatus | null> {
    const svc = this.services[svcKey];
    if (!svc) return null;

    let run: GHARun | undefined;
    try {
      const resp = await this.ghGet<GHARunsResponse>(
        `/repos/${svc.owner}/${svc.repo}/actions/workflows/${svc.workflow}/runs?per_page=1`,
      );
      run = resp.workflow_runs[0];
    } catch (e) {
      return {
        svcKey,
        phase: 'failed',
        detail: (e as Error).message,
      };
    }

    if (!run) {
      return { svcKey, phase: 'idle' };
    }

    const base: Omit<ReleaseStatus, 'phase'> = {
      svcKey,
      runUrl: run.html_url,
      startedAt: run.run_started_at,
    };

    // Still in flight
    if (run.status !== 'completed') {
      return { ...base, phase: 'running' };
    }

    // CI failed or was cancelled
    if (run.conclusion !== 'success') {
      return { ...base, phase: 'failed', completedAt: run.updated_at };
    }

    // CI succeeded
    if (svc.mode === 'complete') {
      return { ...base, phase: 'complete', completedAt: run.updated_at };
    }

    // mode = "trigger": CI done, now check actual rollout via kubectl.
    // kubectlDeployment/Namespace are guaranteed by config validation when mode = "trigger".
    if (!svc.kubectlDeployment || !svc.kubectlNamespace) {
      return {
        ...base,
        phase: 'failed',
        detail: 'kubectl_deployment or kubectl_namespace not configured',
      };
    }
    const rolloutPhase = await kubectlRolloutPhase(
      svc.kubectlDeployment,
      svc.kubectlNamespace,
      this.kubectlCfg,
      svc.kubectlResourceType,
    );

    const phase: ReleasePhase =
      rolloutPhase === 'complete'
        ? 'complete'
        : rolloutPhase === 'running'
          ? 'running'
          : rolloutPhase === 'unreachable'
            ? 'unreachable'
            : 'failed';

    return {
      ...base,
      phase,
      completedAt: rolloutPhase === 'complete' ? run.updated_at : undefined,
      detail: rolloutPhase === 'unreachable' ? 'kubectl cluster unreachable (VPN?)' : undefined,
    };
  }
}
