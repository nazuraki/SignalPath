import type {
  MetricValue,
  ReleaseStatus,
  RolloutProgress,
  Workstream,
} from '../../shared/types.ts';

export interface TicketProvider {
  fetchWorkstreams(): Promise<Workstream[]>;
}

export interface DeployProvider {
  readonly name: string;
  /** Returns null if the service key is not configured. */
  getReleaseStatus(svcKey: string): Promise<ReleaseStatus | null>;
  /**
   * Live rollout detail (percentage, phase, step) for a service. Returns null when
   * the service is unknown or isn't kubectl-watched (mode != "trigger"), in which
   * case the release status alone describes the deploy.
   */
  getRolloutProgress(svcKey: string): Promise<RolloutProgress | null>;
}

export interface MetricsProvider {
  readonly name: string;
  /**
   * External dashboard URL for a service, or null when none is configured.
   * `namespace` is available to templates alongside the service key.
   */
  dashboardUrl(svcKey: string, namespace: string): string | null;
  /**
   * Resolve every configured stat tile for a service. Never rejects — a failed
   * query yields a MetricValue with `value: null` and an `error`, so one bad
   * expression can't blank the whole row.
   */
  fetchMetrics(svcKey: string, namespace: string): Promise<MetricValue[]>;
}
