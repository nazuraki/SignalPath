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

type RawConfig = {
  ui?: { title?: string; subtitle?: string };
  server?: { port?: number };
  jira?: {
    base?: string;
    email?: string;
    api_token?: string;
    sp_field?: string;
    epics?: string[];
  };
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

export const config: ServerConfig = {
  ui: {
    title: parsed.ui?.title ?? 'Project Orchestrator',
    subtitle: parsed.ui?.subtitle ?? '',
  },
  server: {
    port: parsed.server?.port ?? 3001,
  },
  jira: {
    base: parsed.jira?.base ?? '',
    email: parsed.jira?.email ?? '',
    apiToken: parsed.jira?.api_token ?? '',
    spField: parsed.jira?.sp_field ?? 'timeoriginalestimate',
    epics: parsed.jira?.epics ?? [],
  },
  parity: {
    epic: parsed.parity?.epic || null,
    svcMap: parsed.parity?.svc_map ?? {},
    svcLabelMap: parsed.parity?.svc_label_map ?? {},
    modMap: parsed.parity?.mod_map ?? {},
    na: parsed.parity?.na ?? {},
  },
};
