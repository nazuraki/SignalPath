import { resolveServiceKey } from '../../shared/service-key.ts';
import { stageOf } from '../../shared/stage.ts';
import type {
  MetricValue,
  PipelineItem,
  PipelineResponse,
  ReleaseLink,
  ReleaseStatus,
  RolloutProgress,
  ServerConfig,
  Stage,
} from '../../shared/types.ts';
import type { DeployProvider, MetricsProvider, TicketProvider } from '../providers/types.ts';
import { SlackReportClient } from '../report/slack.ts';
import { SlackReleaseFinder, type SlackReleaseResult } from './slackRelease.ts';

/** The release-relevant stages — the page is for controlling releases, not tracking dev work. */
const PIPELINE_STAGES: ReadonlySet<Stage> = new Set<Stage>(['pending', 'releasing', 'released']);

/**
 * Display order: what's in flight first, then what's queued to go, then what
 * already shipped (still listed so its metrics can be eyeballed after release).
 * This deliberately differs from the left-to-right STAGE_ORDER used on the
 * dashboard — here the most urgent row belongs at the top.
 */
const STAGE_RANK: Record<string, number> = { releasing: 0, pending: 1, released: 2 };

export interface PipelineDeps {
  tickets: TicketProvider;
  deploys: DeployProvider;
  metrics: MetricsProvider;
  /** Omitted when Slack isn't configured — release links are then skipped. */
  slackRelease?: SlackReleaseFinder;
}

/**
 * True when tickets are configured and at least one release signal is available.
 * With no deploys, metrics, or Slack the page would just restate the dashboard.
 */
export function isPipelineEnabled(config: ServerConfig): boolean {
  if (config.tickets.provider === 'none') return false;
  return (
    config.deploys.provider !== 'none' ||
    config.metrics.provider !== 'none' ||
    Boolean(config.slack?.userToken)
  );
}

/**
 * Build the Slack release-post finder, or undefined when Slack isn't configured.
 * Construct this once per process — it owns the permalink cache that keeps the
 * page's re-polling inside Slack's rate limit.
 */
export function createSlackReleaseFinder(config: ServerConfig): SlackReleaseFinder | undefined {
  if (!config.slack?.userToken) return undefined;
  return new SlackReleaseFinder(new SlackReportClient(config.slack), {
    channel: config.report?.releaseChannel ?? '',
    match: config.pipeline.slackMatch,
    ttlSeconds: config.pipeline.slackTtl,
  });
}

interface ServiceSignals {
  release?: ReleaseStatus;
  rollout?: RolloutProgress;
  metrics?: MetricValue[];
  grafanaUrl?: string;
  slackRelease?: ReleaseLink;
}

/**
 * Gather the release-relevant tickets and decorate each with its deploy, rollout,
 * Slack, and metrics signals.
 *
 * Only the ticket fetch is fatal; every other source degrades into `warnings` so a
 * down VPN or an expired Grafana token still leaves a usable page. Signals are
 * fetched once per *service*, not per ticket — several tickets commonly share one
 * service, and each lookup costs a kubectl shell-out or an HTTP round trip.
 */
export async function buildPipeline(
  config: ServerConfig,
  deps: PipelineDeps,
): Promise<PipelineResponse> {
  const warnings: string[] = [];
  const workstreams = await deps.tickets.fetchWorkstreams();

  const items: PipelineItem[] = [];
  for (const ws of workstreams) {
    for (const issue of ws.issues ?? []) {
      const stage = stageOf(issue, config.tickets.stageMap);
      if (!PIPELINE_STAGES.has(stage)) continue;
      items.push({
        issue,
        workstreamKey: ws.key,
        workstreamSummary: ws.summary,
        stage,
        svcKey: resolveServiceKey(issue, config.parity),
      });
    }
  }

  items.sort((a, b) => {
    const rank = (STAGE_RANK[a.stage] ?? 9) - (STAGE_RANK[b.stage] ?? 9);
    return rank !== 0 ? rank : a.issue.key.localeCompare(b.issue.key);
  });

  const safe = async <T>(label: string, fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await fn();
    } catch (e) {
      warnings.push(`${label}: ${(e as Error).message}`);
      return undefined;
    }
  };

  const svcKeys = [...new Set(items.map((i) => i.svcKey).filter((k): k is string => k !== null))];

  const signals = new Map<string, ServiceSignals>();
  await Promise.all(
    svcKeys.map(async (svcKey) => {
      const svc = config.deploys.services[svcKey];
      const namespace = svc?.kubectlNamespace ?? svcKey;

      const [release, rollout, metrics, slack] = await Promise.all([
        safe(`Release status for "${svcKey}"`, () => deps.deploys.getReleaseStatus(svcKey)),
        safe(`Rollout progress for "${svcKey}"`, () => deps.deploys.getRolloutProgress(svcKey)),
        safe(`Metrics for "${svcKey}"`, () => deps.metrics.fetchMetrics(svcKey, namespace)),
        deps.slackRelease
          ? deps.slackRelease.find(svcKey, svc?.repo)
          : Promise.resolve<SlackReleaseResult>({ link: null }),
      ]);

      if (slack.warning) warnings.push(slack.warning);
      if (rollout?.unreachable) {
        // One root cause for every service — the dedupe below collapses these
        // into a single banner.
        warnings.push('Kubernetes cluster unreachable — rollout progress unavailable (VPN?)');
      } else if (rollout?.error) {
        warnings.push(`Rollout for "${svcKey}": ${rollout.error}`);
      }

      signals.set(svcKey, {
        release: release ?? undefined,
        rollout: rollout ?? undefined,
        metrics: metrics && metrics.length > 0 ? metrics : undefined,
        grafanaUrl: deps.metrics.dashboardUrl(svcKey, namespace) ?? undefined,
        slackRelease: slack.link ?? undefined,
      });
    }),
  );

  for (const item of items) {
    if (!item.svcKey) continue;
    const s = signals.get(item.svcKey);
    if (s) Object.assign(item, s);
  }

  // Several services sharing one root cause (VPN down) would otherwise repeat the
  // same banner text per service.
  return { items, warnings: [...new Set(warnings)] };
}
