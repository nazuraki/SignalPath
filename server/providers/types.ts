import type { ReleaseStatus, Workstream } from '../../shared/types.ts';

export interface TicketProvider {
  fetchWorkstreams(): Promise<Workstream[]>;
}

export interface DeployProvider {
  readonly name: string;
  /** Returns null if the service key is not configured. */
  getReleaseStatus(svcKey: string): Promise<ReleaseStatus | null>;
}

export interface MetricsProvider {
  readonly name: string;
}
