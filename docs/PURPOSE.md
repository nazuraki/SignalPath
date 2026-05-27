# Purpose

## Problem being solved

Tracking a single work stream across modern engineering toolchains means jumping between
Jira (planning + tickets), GitHub (code + PRs + checks), Argo CD (deployment state),
and Grafana (runtime health). Each tool has its own view, none of them stitch the pieces
together, and the human running the stream ends up holding the cross-tool state in their
head: which ticket maps to which PR, which PR shipped, which service is in which env,
which dashboard to look at when something goes wrong.

SignalPath is a personal dashboard that pulls those pieces into one local view. It
renders epic burndown charts and an optional service × module parity matrix from Jira
today, and the roadmap layers in GitHub, Argo, and Grafana on top of a local
augmentation store (`data/state.json`) that holds per-ticket links and notes the source
tools don't track natively.

The intent is *not* a team-wide project management product — it's a single operator's
heads-up display for the work they personally own.

## Non-goals

- Multi-user collaboration, comments, or assignment workflow — Jira already does this
- Replacing Jira/GitHub/Argo/Grafana as a system of record — SignalPath is a read-mostly view
- Writing back to upstream tools beyond local augmentation notes
- Hosted/SaaS deployment — this is designed to run locally against the user's own credentials
- Generic project management features (gantt charts, resource planning, time tracking)

## Intended audience

A single engineer or tech lead running a defined work stream (one or more epics, one or
more services) who wants a stitched view across the planning, code, deploy, and runtime
tools they already use. Configuration is per-user via `config.toml` with personal API
credentials.
