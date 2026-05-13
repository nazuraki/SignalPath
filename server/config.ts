import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'smol-toml';
import type { ServerConfig } from '../shared/types.ts';

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
      epics?: string[];
    };
    github?: {
      token?: string;
      repos?: RawGitHubRepo[];
    };
  };
  deploys?: { provider?: string };
  metrics?: { provider?: string };
  parity?: {
    epic?: string;
    svc_map?: Record<string, string>;
    svc_label_map?: Record<string, string>;
    mod_map?: Record<string, string>;
    na?: Record<string, string[]>;
  };
};

let parsed: RawConfig;
try {
  parsed = parse(raw) as RawConfig;
} catch (e) {
  console.error(`Failed to parse config.toml: ${(e as Error).message}`);
  process.exit(1);
}

if (parsed.jira !== undefined) {
  console.error(
    'config.toml has a legacy [jira] section. Migrate to [tickets] / [tickets.jira] — see config.example.toml.',
  );
  process.exit(1);
}

const ticketsProvider = (parsed.tickets?.provider ?? 'none') as ServerConfig['tickets']['provider'];

export const config: ServerConfig = {
  ui: {
    title: parsed.ui?.title ?? 'Project Orchestrator',
    subtitle: parsed.ui?.subtitle ?? '',
  },
  server: {
    port: parsed.server?.port ?? 3001,
  },
  tickets: {
    provider: ticketsProvider,
    jira: parsed.tickets?.jira
      ? {
          base: parsed.tickets.jira.base ?? '',
          email: parsed.tickets.jira.email ?? '',
          apiToken: parsed.tickets.jira.api_token ?? '',
          spField: parsed.tickets.jira.sp_field ?? 'timeoriginalestimate',
          epics: parsed.tickets.jira.epics ?? [],
        }
      : undefined,
    github: parsed.tickets?.github
      ? {
          token: parsed.tickets.github.token ?? '',
          repos: (parsed.tickets.github.repos ?? []).map((r) => ({
            owner: r.owner ?? '',
            repo: r.repo ?? '',
            milestones: r.milestones,
          })),
        }
      : undefined,
  },
  deploys: {
    provider: 'none',
  },
  metrics: {
    provider: 'none',
  },
  parity: {
    epic: parsed.parity?.epic || null,
    svcMap: parsed.parity?.svc_map ?? {},
    svcLabelMap: parsed.parity?.svc_label_map ?? {},
    modMap: parsed.parity?.mod_map ?? {},
    na: parsed.parity?.na ?? {},
  },
};
