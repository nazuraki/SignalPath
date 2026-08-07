# Project Orchestrator

A personal dashboard that pulls the tools around a work stream — Jira tickets, GitHub PRs,
Argo deploys, Grafana dashboards — into one view. Tracks each piece of work from plan
through deploy, surfaces cross-stream dependencies, and links out to the relevant places.

It is organized into four pages:

- **Dashboard** (`/`) — epic burndown charts and pipeline status, with release status polled from
  GitHub Actions and Argo Rollouts (or standard Deployments) via kubectl.
- **Pipeline** (`/pipeline`) — release control. A vertical card per ticket in a release-relevant
  stage (`pending` / `releasing` / `released`), each carrying its GitHub Actions run, Argo rollout
  percentage, Slack release announcement, Grafana dashboard link, and live metric tiles. Shown when
  `[tickets]` plus at least one of `[deploys]`, `[metrics]`, or `[slack]` is configured. See
  [Release control](#release-control) below.
- **Parity** (`/parity`) — the optional service-parity matrix from Jira (shown when `[parity].epic`
  is set).
- **Report** (`/report`) — a read-only "previous workday report" that gathers the same activity as
  the `standup-prep` skill (Jira activity + GitHub Actions releases/jar-publishes + Slack signals)
  and renders a pasteable Slack draft. Shown when the `[slack]` and `[report]` config sections are
  present alongside Jira credentials — see `config.example.toml`. The Slack integration needs a
  **user token** (xoxp) with `search:read`; a bot token can't drive the searches the report uses.

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

# ---- Metrics + release control (optional) -----------------------------------
[metrics]
provider = "grafana"              # "grafana" | "none"

[metrics.grafana]
base           = "https://grafana.example.com"
token          = "glsa_..."       # service-account token, Viewer role
datasource_uid = "prometheus-prod"
dashboard_url  = "https://grafana.example.com/d/abc/svc?var-service={{svc}}"

[[metrics.grafana.queries]]       # one stat tile per entry, in order
key   = "p99"
label = "p99"
unit  = "ms"
expr  = 'histogram_quantile(0.99, sum by (le) (rate(http_server_requests_seconds_bucket{namespace="{{namespace}}"}[5m]))) * 1000'

[pipeline]
slack_match  = "New release published"
poll_seconds = 30                 # re-poll cadence while a rollout is live; 0 disables
```

## Release control

The **Pipeline** page (`/pipeline`) is the "a release is going out right now" view. It lists every
ticket whose stage maps to `pending`, `releasing`, or `released` and decorates each with:

| Signal | Source | Requires |
| --- | --- | --- |
| CI phase + run link | GitHub Actions workflow runs | `[deploys.github].token` |
| Rollout % | `kubectl get rollout … -o json` | a service with `mode = "trigger"` |
| Slack release post | `search.messages` in the release channel | `[slack].user_token` + `[report].release_channel` |
| Grafana dashboard | `[metrics.grafana].dashboard_url` template | `[metrics] provider = "grafana"` |
| Metric tiles | Grafana datasource proxy (`POST /api/ds/query`) | `[[metrics.grafana.queries]]` |

A few things worth knowing:

- **Tickets are matched to services through `parity.svc_map`** (component → service key) with
  `parity.svc_label_map` (label → service key) as the fallback. These are the same keys that index
  `[deploys.services]`. A ticket matching neither shows as `no service` with no deploy signals.
- **Signals are fetched once per service, not per ticket** — several tickets commonly share a
  service, and each lookup is a kubectl shell-out or an HTTP round trip.
- **The rollout percentage is derived**, first rule that applies: the canary traffic weight
  (`status.canary.weights.canary.weight`), else the nearest `setWeight` at or before
  `status.currentStepIndex`, else `updatedReplicas / replicas`. When none applies the bar shows
  `—` rather than `0%`. Hover the bar to see which rule produced the number.
- **Everything degrades independently.** Only the ticket fetch is fatal; a down VPN, an expired
  Grafana token, or a Slack scope failure becomes a warning banner and the rest of the page still
  renders. An unreachable cluster raises a single banner rather than one per service.
- **Prometheus is queried through Grafana**, so only Grafana needs to be reachable and the token
  never leaves the server — the client receives built dashboard URLs and resolved numbers only.
- **Polling is conditional.** The page re-polls every `poll_seconds` only while something is
  actually mid-flight, because each poll costs a kubectl call per service. Slack permalinks are
  cached for `slack_ttl` seconds on top of that, since Slack's search API is rate-limited.

Verify the assumptions against your own cluster and Grafana before trusting the numbers:

```bash
kubectl get rollout <name> -n <namespace> -o json | jq '{phase: .status.phase, weights: .status.canary.weights, step: .status.currentStepIndex, replicas: .status.replicas, updated: .status.updatedReplicas}'
```

If `weights` is absent, the canary-weight rule never fires and the bar falls back to the replica
ratio.

## Layout

```
config.toml             # local, gitignored
config.example.toml     # committed reference

shared/
  types.ts              # shared types used by both server and client
  stage.ts              # stageOf — stage classification, used by both sides
  service-key.ts        # resolveServiceKey — issue → deploy-service key via parity maps

server/
  index.ts              # HTTP server — /api/config, /api/burndown, /api/state,
                        # /api/deploy-status, /api/report, /api/pipeline
  config.ts             # TOML loader, normalizes shape
  state.ts              # reads/writes data/state.json (per-ticket annotations)
  pipeline/
    index.ts            # /api/pipeline assembly — per-service signal fan-out
    slackRelease.ts     # resolves + caches the Slack release post per service
  report/               # previous-workday report (jira, github, slack, build)
  providers/
    types.ts            # TicketProvider, DeployProvider, MetricsProvider interfaces
    registry.ts         # factory functions — createTicketProvider, createDeployProvider, …
    tickets/            # jira.ts, github.ts, null.ts
    deploys/
      github-actions.ts # polls GHA workflow runs for release status
      kubectl.ts        # shells out to kubectl for rollout phase + rollout percentage
    metrics/
      grafana.ts        # dashboard links + PromQL via Grafana's datasource proxy

client/
  index.html
  src/
    main.tsx            # React entry
    App.tsx             # top-level layout + data fetch
    styles.css
    pages/              # DashboardPage, PipelinePage, ParityPage, ReportPage
    components/         # StatusPill, CombinedChart, EpicStatsRow, ParityMatrix,
                        # TicketPanel, DataGate, WarningBanner
    lib/                # format, burndown math, parity matrix builder, contexts
                        # (+ *.test.ts files alongside)

data/state.json         # local augmentation: PR#, deploy app, deploy timestamp, notes
```

## Roadmap

- [x] Split out of single-file prototype, Vite build, TOML config
- [x] `data/state.json` augmentation layer — per-ticket PR number, deploy app, deploy timestamp, notes
- [x] Deploy status via GitHub Actions + kubectl / Argo Rollouts
- [x] Release-control pipeline page — rollout %, Slack release post, Grafana links + metrics
- [ ] Inline annotation UI to edit `state.json` from the dashboard
- [ ] GitHub: PR state, checks, merge status
- [ ] Cross-stream dependency view from Jira `issuelinks`
- [ ] Grafana: deep links per service
