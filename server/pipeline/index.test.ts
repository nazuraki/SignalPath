import { describe, expect, it, vi } from 'vitest';
import type {
  Issue,
  MetricValue,
  ReleaseStatus,
  RolloutProgress,
  ServerConfig,
  Workstream,
} from '../../shared/types.ts';
import type { DeployProvider, MetricsProvider, TicketProvider } from '../providers/types.ts';
import { buildPipeline, isPipelineEnabled, type PipelineDeps } from './index.ts';
import type { SlackReleaseFinder } from './slackRelease.ts';

const issue = (overrides: Partial<Issue> = {}): Issue => ({
  key: 'X-1',
  summary: 's',
  status: 'Ready for Release',
  points: null,
  resolutiondate: null,
  labels: [],
  components: [],
  ...overrides,
});

const workstream = (issues: Issue[]): Workstream => ({
  key: 'E-1',
  summary: 'Epic One',
  status: 'In Progress',
  created: '2025-01-01',
  duedate: null,
  issues,
});

const config = (overrides: Partial<ServerConfig> = {}): ServerConfig => ({
  ui: { title: 't', subtitle: '' },
  server: { port: 1 },
  tickets: {
    provider: 'jira',
    stageMap: {
      'ready for release': 'pending',
      releasing: 'releasing',
      released: 'released',
      'in progress': 'progress',
    },
    jira: { base: 'https://j', email: 'e', apiToken: 't', spField: 'sp', epics: ['E-1'] },
  },
  deploys: {
    provider: 'github-actions',
    github: { token: 'ghp' },
    services: {
      'service-a': {
        owner: 'org',
        repo: 'repo-a',
        workflow: 'w.yml',
        mode: 'trigger',
        kubectlResourceType: 'argo-rollout',
        kubectlDeployment: 'service-a',
        kubectlNamespace: 'ns-a',
      },
    },
  },
  metrics: { provider: 'none' },
  parity: {
    epic: null,
    svcMap: { 'Service A Core': 'service-a' },
    svcLabelMap: {},
    modMap: {},
    na: {},
  },
  pipeline: { slackMatch: 'New release published', slackTtl: 120, pollSeconds: 30 },
  ...overrides,
});

const tickets = (workstreams: Workstream[]): TicketProvider => ({
  fetchWorkstreams: () => Promise.resolve(workstreams),
});

const deploys = (
  rollout: RolloutProgress | null = { percent: 50, source: 'replicas' },
): DeployProvider => ({
  name: 'fake',
  getReleaseStatus: vi.fn(
    (svcKey: string): Promise<ReleaseStatus | null> =>
      Promise.resolve({ svcKey, phase: 'complete', runUrl: 'https://gha/1' }),
  ),
  getRolloutProgress: vi.fn(() => Promise.resolve(rollout)),
});

const metrics = (values: MetricValue[] = []): MetricsProvider => ({
  name: 'fake',
  dashboardUrl: (svcKey, namespace) => `https://g/${svcKey}/${namespace}`,
  fetchMetrics: vi.fn(() => Promise.resolve(values)),
});

const deps = (overrides: Partial<PipelineDeps> = {}): PipelineDeps => ({
  tickets: tickets([]),
  deploys: deploys(),
  metrics: metrics(),
  ...overrides,
});

describe('isPipelineEnabled', () => {
  it('is false without a ticket provider', () => {
    expect(isPipelineEnabled(config({ tickets: { provider: 'none', stageMap: {} } }))).toBe(false);
  });

  it('is false when no release signal is configured', () => {
    expect(
      isPipelineEnabled(
        config({
          deploys: { provider: 'none', services: {} },
          metrics: { provider: 'none' },
          slack: undefined,
        }),
      ),
    ).toBe(false);
  });

  it('is true with deploys configured', () => {
    expect(isPipelineEnabled(config())).toBe(true);
  });

  it('is true with only Slack configured', () => {
    expect(
      isPipelineEnabled(
        config({
          deploys: { provider: 'none', services: {} },
          slack: { userToken: 'xoxp', base: 'https://slack.com/api' },
        }),
      ),
    ).toBe(true);
  });
});

describe('buildPipeline', () => {
  it('keeps only release-relevant stages', async () => {
    const ws = workstream([
      issue({ key: 'A-1', status: 'In Progress' }),
      issue({ key: 'A-2', status: 'Ready for Release' }),
      issue({ key: 'A-3', status: 'Releasing' }),
      issue({ key: 'A-4', status: 'Released' }),
      issue({ key: 'A-5', status: 'Done', resolutiondate: '2025-01-02' }),
      issue({ key: 'A-6', status: 'To Do' }),
    ]);
    const { items } = await buildPipeline(config(), deps({ tickets: tickets([ws]) }));
    expect(items.map((i) => i.issue.key)).toEqual(['A-3', 'A-2', 'A-4']);
  });

  it('orders in-flight first, then pending, then released', async () => {
    const ws = workstream([
      issue({ key: 'B-2', status: 'Released' }),
      issue({ key: 'B-1', status: 'Ready for Release' }),
      issue({ key: 'B-3', status: 'Releasing' }),
      issue({ key: 'B-0', status: 'Releasing' }),
    ]);
    const { items } = await buildPipeline(config(), deps({ tickets: tickets([ws]) }));
    expect(items.map((i) => [i.issue.key, i.stage])).toEqual([
      ['B-0', 'releasing'],
      ['B-3', 'releasing'],
      ['B-1', 'pending'],
      ['B-2', 'released'],
    ]);
  });

  it('fetches each signal once per service, not once per ticket', async () => {
    const ws = workstream([
      issue({ key: 'C-1', components: ['Service A Core'] }),
      issue({ key: 'C-2', components: ['Service A Core'] }),
      issue({ key: 'C-3', components: ['Service A Core'] }),
    ]);
    const d = deps({ tickets: tickets([ws]) });
    const { items } = await buildPipeline(config(), d);

    expect(items).toHaveLength(3);
    expect(d.deploys.getReleaseStatus).toHaveBeenCalledTimes(1);
    expect(d.deploys.getRolloutProgress).toHaveBeenCalledTimes(1);
    expect(d.metrics.fetchMetrics).toHaveBeenCalledTimes(1);
    // …and every ticket still carries the signals.
    for (const item of items) {
      expect(item.svcKey).toBe('service-a');
      expect(item.rollout?.percent).toBe(50);
      expect(item.release?.runUrl).toBe('https://gha/1');
      expect(item.grafanaUrl).toBe('https://g/service-a/ns-a');
    }
  });

  it('passes the service namespace to the metrics provider', async () => {
    const ws = workstream([issue({ key: 'D-1', components: ['Service A Core'] })]);
    const d = deps({ tickets: tickets([ws]) });
    await buildPipeline(config(), d);
    expect(d.metrics.fetchMetrics).toHaveBeenCalledWith('service-a', 'ns-a');
  });

  it('fetches no signals for a ticket that maps to no service', async () => {
    const ws = workstream([issue({ key: 'E-2', components: ['Unmapped'] })]);
    const d = deps({ tickets: tickets([ws]) });
    const { items } = await buildPipeline(config(), d);
    expect(items[0].svcKey).toBeNull();
    expect(items[0].rollout).toBeUndefined();
    expect(d.deploys.getReleaseStatus).not.toHaveBeenCalled();
  });

  it('degrades a failing signal into a warning and still returns items', async () => {
    const ws = workstream([issue({ key: 'F-1', components: ['Service A Core'] })]);
    const brokenMetrics: MetricsProvider = {
      name: 'broken',
      dashboardUrl: () => null,
      fetchMetrics: () => Promise.reject(new Error('token expired')),
    };
    const { items, warnings } = await buildPipeline(
      config(),
      deps({ tickets: tickets([ws]), metrics: brokenMetrics }),
    );
    expect(items).toHaveLength(1);
    expect(items[0].metrics).toBeUndefined();
    expect(warnings).toEqual(['Metrics for "service-a": token expired']);
  });

  it('names the service for a rollout error specific to that resource', async () => {
    const ws = workstream([issue({ key: 'G-1', components: ['Service A Core'] })]);
    const { items, warnings } = await buildPipeline(
      config(),
      deps({
        tickets: tickets([ws]),
        deploys: deploys({ percent: null, source: null, error: 'rollouts "service-a" not found' }),
      }),
    );
    expect(items[0].rollout?.error).toBe('rollouts "service-a" not found');
    expect(warnings).toEqual(['Rollout for "service-a": rollouts "service-a" not found']);
  });

  it('collects the Slack release link and its lookup warnings', async () => {
    const ws = workstream([issue({ key: 'H-1', components: ['Service A Core'] })]);
    const finder = {
      find: vi.fn(() =>
        Promise.resolve({
          link: { url: 'https://slack/p1', text: 'New release published — repo-a v2' },
          warning: undefined,
        }),
      ),
    } as unknown as SlackReleaseFinder;

    const { items } = await buildPipeline(
      config(),
      deps({ tickets: tickets([ws]), slackRelease: finder }),
    );
    expect(finder.find).toHaveBeenCalledWith('service-a', 'repo-a');
    expect(items[0].slackRelease?.url).toBe('https://slack/p1');
  });

  it('raises one unreachable-cluster banner however many services are affected', async () => {
    const cfg = config();
    cfg.deploys.services['service-b'] = { ...cfg.deploys.services['service-a'], repo: 'repo-b' };
    cfg.parity.svcMap['Service B Core'] = 'service-b';
    const ws = workstream([
      issue({ key: 'I-1', components: ['Service A Core'] }),
      issue({ key: 'I-2', components: ['Service B Core'] }),
    ]);
    const { items, warnings } = await buildPipeline(
      cfg,
      deps({
        tickets: tickets([ws]),
        deploys: deploys({
          percent: null,
          source: null,
          error: 'cluster unreachable (VPN?)',
          unreachable: true,
        }),
      }),
    );
    // Both tickets still render, each showing the inline reason.
    expect(items.map((i) => i.svcKey)).toEqual(['service-a', 'service-b']);
    expect(warnings).toEqual([
      'Kubernetes cluster unreachable — rollout progress unavailable (VPN?)',
    ]);
  });

  it('keeps per-service warnings separate when the causes differ', async () => {
    const cfg = config();
    cfg.deploys.services['service-b'] = { ...cfg.deploys.services['service-a'], repo: 'repo-b' };
    cfg.parity.svcMap['Service B Core'] = 'service-b';
    const ws = workstream([
      issue({ key: 'J-1', components: ['Service A Core'] }),
      issue({ key: 'J-2', components: ['Service B Core'] }),
    ]);
    const brokenMetrics: MetricsProvider = {
      name: 'broken',
      dashboardUrl: () => null,
      fetchMetrics: (svcKey) => Promise.reject(new Error(`down for ${svcKey}`)),
    };
    const { warnings } = await buildPipeline(
      cfg,
      deps({ tickets: tickets([ws]), metrics: brokenMetrics }),
    );
    expect(warnings.sort()).toEqual([
      'Metrics for "service-a": down for service-a',
      'Metrics for "service-b": down for service-b',
    ]);
  });

  it('propagates a ticket-fetch failure — it is the one fatal source', async () => {
    await expect(
      buildPipeline(
        config(),
        deps({ tickets: { fetchWorkstreams: () => Promise.reject(new Error('jira 401')) } }),
      ),
    ).rejects.toThrow('jira 401');
  });
});
