import type { Workstream } from '../../shared/types.ts';

export interface TicketProvider {
  fetchWorkstreams(): Promise<Workstream[]>;
}

export interface DeployProvider {
  readonly name: string;
}

export interface MetricsProvider {
  readonly name: string;
}
