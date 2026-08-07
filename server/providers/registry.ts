import type {
  DeploysConfig,
  MetricsConfig,
  MetricValue,
  ReleaseStatus,
  RolloutProgress,
  TicketsConfig,
} from '../../shared/types.ts';
import { GitHubActionsDeployProvider } from './deploys/github-actions.ts';
import { GrafanaMetricsProvider } from './metrics/grafana.ts';
import { GitHubTicketProvider } from './tickets/github.ts';
import { JiraTicketProvider } from './tickets/jira.ts';
import { NullTicketProvider } from './tickets/null.ts';
import type { DeployProvider, MetricsProvider, TicketProvider } from './types.ts';

export const createTicketProvider = (cfg: TicketsConfig): TicketProvider => {
  switch (cfg.provider) {
    case 'jira':
      if (!cfg.jira)
        throw new Error('tickets.provider = "jira" but [tickets.jira] is missing from config');
      return new JiraTicketProvider(cfg.jira);
    case 'github':
      if (!cfg.github)
        throw new Error('tickets.provider = "github" but [tickets.github] is missing from config');
      return new GitHubTicketProvider(cfg.github);
    case 'none':
      return new NullTicketProvider();
    default:
      throw new Error(`Unknown ticket provider: "${(cfg as TicketsConfig).provider}"`);
  }
};

export const createDeployProvider = (cfg: DeploysConfig): DeployProvider => {
  switch (cfg.provider) {
    case 'github-actions':
      if (!cfg.github)
        throw new Error(
          'deploys.provider = "github-actions" but [deploys.github] is missing from config',
        );
      return new GitHubActionsDeployProvider(cfg.github, cfg.services, cfg.kubectl);
    case 'none':
      return {
        name: 'none',
        getReleaseStatus: (_svcKey: string): Promise<ReleaseStatus | null> => Promise.resolve(null),
        getRolloutProgress: (_svcKey: string): Promise<RolloutProgress | null> =>
          Promise.resolve(null),
      };
    default:
      throw new Error(`Unknown deploy provider: "${(cfg as DeploysConfig).provider}"`);
  }
};

export const createMetricsProvider = (cfg: MetricsConfig): MetricsProvider => {
  switch (cfg.provider) {
    case 'grafana':
      if (!cfg.grafana)
        throw new Error(
          'metrics.provider = "grafana" but [metrics.grafana] is missing from config',
        );
      return new GrafanaMetricsProvider(cfg.grafana);
    case 'none':
      return {
        name: 'none',
        dashboardUrl: (): string | null => null,
        fetchMetrics: (): Promise<MetricValue[]> => Promise.resolve([]),
      };
    default:
      throw new Error(`Unknown metrics provider: "${(cfg as MetricsConfig).provider}"`);
  }
};
