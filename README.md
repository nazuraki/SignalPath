# Project Orchestrator

A personal dashboard that pulls the tools around a work stream — Jira tickets, GitHub PRs,
Argo deploys, Grafana dashboards — into one view. Tracks each piece of work from plan
through deploy, surfaces cross-stream dependencies, and links out to the relevant places.

Today it renders epic burndown charts, an optional service-parity matrix from Jira, and
release status by polling GitHub Actions and Argo Rollouts (or standard Deployments) via kubectl.

See [docs/PURPOSE.md](docs/PURPOSE.md) for the problem statement, non-goals, and intended audience.

## License

MIT

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
# edit config.toml — fill in credentials, epics, and optional deploys/parity sections
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
just testwatch          # Vitest watch mode
just check              # lint + typecheck + test + build (what CI runs)
```

Run `just` with no args to list every recipe.

## CI

`.github/workflows/ci.yml` runs `npm ci → lint → typecheck → test → build` on every push to
`main` and every pull request, against the Node version pinned in `.nvmrc`. The workflow seeds
`config.toml` from `config.example.toml` so the server-side TOML loader doesn't error during
typecheck/build.

## Configuration (`config.toml`)

Copy `config.example.toml` to `config.toml` (gitignored) and fill in credentials.
The example file is the annotated reference — the snippet below shows the overall shape.

```toml
[ui]
title    = "Project Orchestrator"
subtitle = "local"                # optional eyebrow text shown above the title

[server]
port = 5167                       # API port; Vite dev server uses 5173 separately

# ---- Tickets (Jira or GitHub Issues) ----------------------------------------
[tickets]
provider = "jira"                 # "jira" | "github" | "none"

[tickets.jira]
base      = "https://your-org.atlassian.net"
email     = "you@example.com"
api_token = ""
sp_field  = "timeoriginalestimate"
epics     = ["PROJ-1", "PROJ-2"]

# ---- Deploy status (GitHub Actions + kubectl/Argo Rollouts) -----------------
[deploys]
provider = "github-actions"       # "github-actions" | "none"

[deploys.github]
token = "ghp_..."                 # PAT with Actions read access

[deploys.defaults]                # applied to every service unless overridden
owner                 = "myorg"
mode                  = "trigger" # "complete" | "trigger"
kubectl_resource_type = "argo-rollout" # "deployment" | "argo-rollout"
workflow              = "ci-production.yaml"

[deploys.services.service-a]     # key must match a parity.svc_map value
# all fields inferred from key + defaults

[deploys.services.service-b]
workflow = "ci-prod-b.yaml"      # only override what differs

[deploys.kubectl]
# context = "prod-cluster"       # omit to use current-context

# ---- Service × module parity matrix (optional) ------------------------------
[parity]
epic = "PROJ-1"                   # leave "" to disable

[parity.svc_map]                  # Jira component → service key
"Service A Core" = "service-a"

[parity.mod_map]                  # Jira label → module column (order = column order)
module-a = "Module A"
module-b = "Module B"
```

## Layout

```
config.toml             # local, gitignored
config.example.toml     # committed reference

shared/
  types.ts              # shared types used by both server and client

server/
  index.ts              # HTTP server — /api/config, /api/burndown, /api/state, /api/deploy-status
  config.ts             # TOML loader, normalizes shape
  state.ts              # reads/writes data/state.json (per-ticket annotations)
  providers/
    types.ts            # TicketProvider, DeployProvider, MetricsProvider interfaces
    registry.ts         # factory functions — createTicketProvider, createDeployProvider
    tickets/            # jira.ts, github.ts, null.ts
    deploys/
      github-actions.ts # polls GHA workflow runs for release status
      kubectl.ts        # shells out to kubectl (or kubectl argo rollouts) for rollout phase

client/
  index.html
  src/
    main.tsx            # React entry
    App.tsx             # top-level layout + data fetch
    styles.css
    components/         # StatusPill, CombinedChart, EpicStatsRow, ParityMatrix, TicketPanel
    lib/                # format, burndown math, parity matrix builder, config context
                        # (+ *.test.ts files alongside)

data/state.json         # local augmentation: PR#, deploy app, deploy timestamp, notes
```

## Roadmap

- [x] Split out of single-file prototype, Vite build, TOML config
- [x] `data/state.json` augmentation layer — per-ticket PR number, deploy app, deploy timestamp, notes
- [x] Deploy status via GitHub Actions + kubectl / Argo Rollouts
- [ ] Inline annotation UI to edit `state.json` from the dashboard
- [ ] GitHub: PR state, checks, merge status
- [ ] Cross-stream dependency view from Jira `issuelinks`
- [ ] Grafana: deep links per service
