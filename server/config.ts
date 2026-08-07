import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'smol-toml';
import type { MetricQueryConfig, ServerConfig, Stage } from '../shared/types.ts';

const DEFAULT_STAGE_MAP: Record<string, Stage> = {
  'ready for release': 'pending',
};

const VALID_STAGES: ReadonlySet<Stage> = new Set([
  'backlog',
  'progress',
  'review',
  'pending',
  'releasing',
  'released',
  'done',
]);

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CONFIG_PATH = join(ROOT, 'config.toml');
const EXAMPLE_PATH = join(ROOT, 'config.example.toml');

if (!existsSync(CONFIG_PATH)) {
  console.error(`config.toml not found at ${CONFIG_PATH}`);
  if (existsSync(EXAMPLE_PATH)) {
    console.error('Copy config.example.toml to config.toml and edit to match your workspace.');
  }
  process.exit(1);
}

const raw = readFileSync(CONFIG_PATH, 'utf8');

type RawGitHubRepo = {
  owner?: string;
  repo?: string;
  milestones?: number[];
};

type RawConfig = {
  ui?: { title?: string; subtitle?: string };
  server?: { port?: number };
  /** Legacy key — emit a migration error if present. */
  jira?: unknown;
  tickets?: {
    provider?: string;
    jira?: {
      base?: string;
      email?: string;
      api_token?: string;
      sp_field?: string;
      sp_field_fallback?: string;
      epics?: string[];
    };
    github?: {
      token?: string;
      repos?: RawGitHubRepo[];
      points_labels?: Record<string, number>;
    };
    stage_map?: Record<string, string>;
  };
  deploys?: {
    provider?: string;
    github?: { token?: string };
    kubectl?: { context?: string };
    defaults?: {
      owner?: string;
      workflow?: string;
      mode?: string;
      kubectl_resource_type?: string;
    };
    services?: Record<
      string,
      {
        owner?: string;
        repo?: string;
        workflow?: string;
        mode?: string;
        kubectl_resource_type?: string;
        kubectl_deployment?: string;
        kubectl_namespace?: string;
      }
    >;
  };
  metrics?: {
    provider?: string;
    grafana?: {
      base?: string;
      token?: string;
      datasource_uid?: string;
      dashboard_url?: string;
      dashboards?: Record<string, string>;
      window?: string;
      queries?: Array<{ key?: string; label?: string; expr?: string; unit?: string }>;
    };
  };
  pipeline?: {
    slack_match?: string;
    slack_ttl?: number;
    poll_seconds?: number;
  };
  parity?: {
    epic?: string;
    svc_map?: Record<string, string>;
    svc_label_map?: Record<string, string>;
    mod_map?: Record<string, string>;
    na?: Record<string, string[]>;
  };
  slack?: {
    user_token?: string;
    base?: string;
  };
  report?: {
    jira_project?: string;
    jira_account_id?: string;
    github_login?: string;
    slack_user_id?: string;
    github_org?: string;
    team_services?: string[];
    library_repos?: string[];
    release_channel?: string;
    release_bot?: string;
    reaction_emojis?: string[];
    github_token?: string;
  };
};

let parsed: RawConfig;
try {
  parsed = parse(raw) as RawConfig;
} catch (e) {
  console.error(`Failed to parse config.toml: ${(e as Error).message}`);
  process.exit(1);
}

function normalizePointsLabels(raw: Record<string, number> | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      console.error(
        `config.toml: [tickets.github.points_labels] "${k}" = ${JSON.stringify(v)} — must be a number.`,
      );
      process.exit(1);
    }
    out[k.toLowerCase()] = v;
  }
  return out;
}

if (parsed.jira !== undefined) {
  console.error(
    'config.toml has a legacy [jira] section. Migrate to [tickets] / [tickets.jira] — see config.example.toml.',
  );
  process.exit(1);
}

const ticketsProvider = (parsed.tickets?.provider ?? 'none') as ServerConfig['tickets']['provider'];

const rawStageMap = parsed.tickets?.stage_map;
const stageMap: Record<string, Stage> = {};
if (rawStageMap === undefined) {
  for (const [k, v] of Object.entries(DEFAULT_STAGE_MAP)) stageMap[k] = v;
} else {
  for (const [k, v] of Object.entries(rawStageMap)) {
    if (!VALID_STAGES.has(v as Stage)) {
      console.error(
        `config.toml: [tickets.stage_map] "${k}" = "${v}" — "${v}" is not a valid stage. Valid: ${[...VALID_STAGES].join(', ')}`,
      );
      process.exit(1);
    }
    stageMap[k.toLowerCase()] = v as Stage;
  }
}

export const config: ServerConfig = {
  ui: {
    title: parsed.ui?.title ?? 'Project Orchestrator',
    subtitle: parsed.ui?.subtitle ?? '',
  },
  server: {
    // PORT env wins (handy for containers / running a second instance), then config, then default.
    port: Number(process.env.PORT) || parsed.server?.port || 5167,
  },
  tickets: {
    provider: ticketsProvider,
    jira: parsed.tickets?.jira
      ? {
          base: parsed.tickets.jira.base ?? '',
          email: parsed.tickets.jira.email ?? '',
          apiToken: parsed.tickets.jira.api_token ?? '',
          spField: parsed.tickets.jira.sp_field ?? 'timeoriginalestimate',
          spFieldFallback: parsed.tickets.jira.sp_field_fallback,
          epics: parsed.tickets.jira.epics ?? [],
        }
      : undefined,
    stageMap,
    github: parsed.tickets?.github
      ? {
          token: parsed.tickets.github.token ?? '',
          repos: (parsed.tickets.github.repos ?? []).map((r) => ({
            owner: r.owner ?? '',
            repo: r.repo ?? '',
            milestones: r.milestones,
          })),
          pointsLabels: normalizePointsLabels(parsed.tickets.github.points_labels),
        }
      : undefined,
  },
  deploys: (() => {
    const rawDeploys = parsed.deploys;
    const provider = (rawDeploys?.provider ?? 'none') as ServerConfig['deploys']['provider'];
    if (provider !== 'github-actions' && provider !== 'none') {
      console.error(
        `config.toml: [deploys] provider = "${provider}" is not supported. Valid: "github-actions", "none"`,
      );
      process.exit(1);
    }
    const defs = rawDeploys?.defaults ?? {};
    const services: ServerConfig['deploys']['services'] = {};
    for (const [key, svc] of Object.entries(rawDeploys?.services ?? {})) {
      // Per-service values take precedence over defaults; name-derived values are last resort.
      const mode = (svc.mode ?? defs.mode ?? 'complete') as string;
      if (mode !== 'complete' && mode !== 'trigger') {
        console.error(
          `config.toml: [deploys.services.${key}] mode = "${mode}" — must be "complete" or "trigger"`,
        );
        process.exit(1);
      }
      const resourceType = svc.kubectl_resource_type ?? defs.kubectl_resource_type ?? 'deployment';
      if (resourceType !== 'deployment' && resourceType !== 'argo-rollout') {
        console.error(
          `config.toml: [deploys.services.${key}] kubectl_resource_type = "${resourceType}" — must be "deployment" or "argo-rollout"`,
        );
        process.exit(1);
      }
      // repo, kubectl_deployment, kubectl_namespace all default to the service key.
      const kubectlDeployment = svc.kubectl_deployment ?? key;
      const kubectlNamespace = svc.kubectl_namespace ?? key;
      if (mode === 'trigger' && (!kubectlDeployment || !kubectlNamespace)) {
        console.error(
          `config.toml: [deploys.services.${key}] mode = "trigger" requires kubectl_deployment and kubectl_namespace (or a service key to derive them from)`,
        );
        process.exit(1);
      }
      services[key] = {
        owner: svc.owner ?? defs.owner ?? '',
        repo: svc.repo ?? key,
        workflow: svc.workflow ?? defs.workflow ?? '',
        mode: mode as 'complete' | 'trigger',
        kubectlResourceType: resourceType as 'deployment' | 'argo-rollout',
        kubectlDeployment,
        kubectlNamespace,
      };
    }
    const defaults: ServerConfig['deploys']['defaults'] = {
      owner: defs.owner,
      workflow: defs.workflow,
      mode: defs.mode as 'complete' | 'trigger' | undefined,
      kubectlResourceType: defs.kubectl_resource_type as 'deployment' | 'argo-rollout' | undefined,
    };
    return {
      provider,
      github: rawDeploys?.github ? { token: rawDeploys.github.token ?? '' } : undefined,
      kubectl: rawDeploys?.kubectl ? { context: rawDeploys.kubectl.context } : undefined,
      defaults,
      services,
    } satisfies ServerConfig['deploys'];
  })(),
  metrics: (() => {
    const rawMetrics = parsed.metrics;
    const provider = (rawMetrics?.provider ?? 'none') as ServerConfig['metrics']['provider'];
    if (provider !== 'grafana' && provider !== 'none') {
      console.error(
        `config.toml: [metrics] provider = "${provider}" is not supported. Valid: "grafana", "none"`,
      );
      process.exit(1);
    }
    if (provider === 'none') return { provider } satisfies ServerConfig['metrics'];

    const g = rawMetrics?.grafana;
    for (const field of ['base', 'token', 'datasource_uid'] as const) {
      if (!g?.[field]) {
        console.error(
          `config.toml: [metrics] provider = "grafana" requires [metrics.grafana] ${field}`,
        );
        process.exit(1);
      }
    }
    const queries: MetricQueryConfig[] = [];
    for (const [i, q] of (g?.queries ?? []).entries()) {
      if (!q.key || !q.expr) {
        console.error(
          `config.toml: [[metrics.grafana.queries]] #${i + 1} — both key and expr are required`,
        );
        process.exit(1);
      }
      queries.push({ key: q.key, label: q.label ?? q.key, expr: q.expr, unit: q.unit });
    }
    return {
      provider,
      grafana: {
        base: g?.base ?? '',
        token: g?.token ?? '',
        datasourceUid: g?.datasource_uid ?? '',
        dashboardUrl: g?.dashboard_url,
        dashboards: g?.dashboards ?? {},
        window: g?.window ?? '15m',
        queries,
      },
    } satisfies ServerConfig['metrics'];
  })(),
  pipeline: {
    slackMatch: parsed.pipeline?.slack_match ?? 'New release published',
    slackTtl: parsed.pipeline?.slack_ttl ?? 120,
    pollSeconds: parsed.pipeline?.poll_seconds ?? 30,
  },
  parity: {
    epic: parsed.parity?.epic || null,
    svcMap: parsed.parity?.svc_map ?? {},
    svcLabelMap: parsed.parity?.svc_label_map ?? {},
    modMap: parsed.parity?.mod_map ?? {},
    na: parsed.parity?.na ?? {},
  },
  slack: parsed.slack?.user_token
    ? {
        userToken: parsed.slack.user_token,
        base: parsed.slack.base ?? 'https://slack.com/api',
      }
    : undefined,
  report: parsed.report
    ? {
        jiraProject: parsed.report.jira_project ?? '',
        jiraAccountId: parsed.report.jira_account_id ?? '',
        githubLogin: parsed.report.github_login ?? '',
        slackUserId: parsed.report.slack_user_id ?? '',
        githubOrg: parsed.report.github_org ?? '',
        teamServices: parsed.report.team_services ?? [],
        libraryRepos: parsed.report.library_repos ?? [],
        releaseChannel: (parsed.report.release_channel ?? '').replace(/^#/, ''),
        releaseBot: parsed.report.release_bot ?? '',
        reactionEmojis: parsed.report.reaction_emojis ?? ['rocket-launch'],
        githubToken: parsed.report.github_token,
      }
    : undefined,
};
