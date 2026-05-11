# Project Orchestrator

A personal dashboard that pulls the tools around a work stream — Jira tickets, GitHub PRs,
Argo deploys, Grafana dashboards — into one view. Tracks each piece of work from plan
through deploy, surfaces cross-stream dependencies, and links out to the relevant places.

Today it renders epic burndown charts and an optional service-parity matrix from Jira.
Future work layers a local augmentation store on top, then GitHub / Argo / Grafana.

## Stack

- **Server:** Node (>= 24), TypeScript via `tsx`, plain HTTP, no framework
- **Client:** React 18 + Recharts, built with Vite, TypeScript
- **Config + credentials:** TOML (`config.toml`), gitignored — copy from `config.example.toml`
- **Tooling:** Biome (lint + format), tsc (typecheck), Vitest (tests), GitHub Actions (CI)

## Setup

```sh
nvm use                 # picks up Node 24 from .nvmrc
just install            # npm install
just init               # creates config.toml from the example
# edit config.toml — fill in jira.email + jira.api_token, set jira.epics, optional parity matrix
```

Jira API token: <https://id.atlassian.com/manage-profile/security/api-tokens>

## Running

```sh
just dev                # API on :3001, Vite on :5173 with /api proxy → open :5173
just build              # build client to ./dist
just start              # build + serve from a single Node process on :3001
just lint               # Biome lint + format check
just fix                # Biome auto-fix
just typecheck          # tsc --noEmit
just test               # run Vitest once
just test-watch         # Vitest watch mode
just check              # lint + typecheck + test + build (what CI runs)
```

Run `just` with no args to list every recipe.

## CI

`.github/workflows/ci.yml` runs `npm ci → lint → typecheck → test → build` on every push to
`main` and every pull request, against the Node version pinned in `.nvmrc`. The workflow seeds
`config.toml` from `config.example.toml` so the server-side TOML loader doesn't error during
typecheck/build.

## Configuration (`config.toml`)

```toml
[ui]
title    = "Project Orchestrator"
subtitle = "local"                # optional eyebrow text shown above the title

[server]
port = 3001                       # API port; Vite dev server uses 5173 separately

[jira]
base      = "https://your-org.atlassian.net"
email     = "you@example.com"
api_token = ""                    # https://id.atlassian.com/manage-profile/security/api-tokens
sp_field  = "timeoriginalestimate" # or a custom field id, e.g. "customfield_10016"
epics     = ["PROJ-1", "PROJ-2"]

# Optional service × module parity matrix for one of the epics above.
# Leave epic = "" to disable.
[parity]
epic = "PROJ-1"

[parity.svc_map]                  # Jira component name → service row label
"Service A Core" = "service-a"

[parity.svc_label_map]            # Jira label → service row label (fallback)
ServiceB = "service-b"

[parity.mod_map]                  # Jira label → module column label (order = column order)
module-a = "Module A"
module-b = "Module B"

[parity.na]                       # service → modules that are not applicable
"service-a" = ["module-b"]
```

See `config.example.toml` for the annotated reference.

## Layout

```
config.toml             # local, gitignored
config.example.toml     # committed reference

shared/
  types.ts              # Epic, Issue, BurndownResult, config shapes — used by both sides

server/
  index.ts              # HTTP server, /api/config + /api/burndown, static
  config.ts             # TOML loader, normalizes shape
  jira.ts               # Jira REST client

client/
  index.html
  src/
    main.tsx            # React entry
    App.tsx             # top-level layout + data fetch
    styles.css
    components/         # StatusPill, CombinedChart, EpicStatsRow, ParityMatrix, TicketPanel
    lib/                # format, burndown math, parity matrix builder, config context
                        # (+ *.test.ts files alongside)

data/state.json         # (future) local augmentation: PR#, argo app, deploy ts, notes
```

## Roadmap

- [x] Split out of single-file prototype, Vite build, TOML config
- [ ] `data/state.json` augmentation layer — per-ticket PR number, Argo app, Grafana URL, deploy timestamp, notes
- [ ] Inline annotation UI to edit `state.json` from the dashboard
- [ ] GitHub: PR state, checks, merge status
- [ ] Cross-stream dependency view from Jira `issuelinks`
- [ ] Argo CD: app sync + health status
- [ ] Grafana: deep links per service
