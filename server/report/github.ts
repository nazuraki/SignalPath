import { ghGet } from '../providers/deploys/github-client.ts';
import type { DateWindow } from './dateWindow.ts';

/** A service release the user triggered (team-service repo). */
export interface ReleaseRun {
  repo: string;
  /** Version / branch the release ran on (e.g. "v1.48.0"), when identifiable. */
  version?: string;
  url: string;
  at: string;
}

/** A jar publish the user triggered (library repo). */
export interface JarPublish {
  repo: string;
  /** Number of distinct successful publish runs in the window. */
  count: number;
  url: string;
}

export interface GithubSweep {
  releases: ReleaseRun[];
  jarPublishes: JarPublish[];
}

interface GHARun {
  name: string;
  display_title: string;
  head_branch: string;
  conclusion: string | null;
  created_at: string;
  html_url: string;
}

interface GHARunsResponse {
  workflow_runs?: GHARun[];
}

/** Tag-cutting runs are folded into their release, not counted separately. */
const isTagRun = (name: string): boolean => /tag\s*release/i.test(name);

async function sweepRepo(
  token: string,
  org: string,
  repo: string,
  login: string,
  window: DateWindow,
): Promise<GHARun[]> {
  const qs = new URLSearchParams({
    event: 'workflow_dispatch',
    status: 'success',
    actor: login,
    created: `${window.startDate}..${window.endDate}`,
    per_page: '50',
  });
  const resp = await ghGet<GHARunsResponse>(token, `/repos/${org}/${repo}/actions/runs?${qs}`);
  return resp.workflow_runs ?? [];
}

/**
 * Sweep team-service and library repos for successful workflow_dispatch runs the
 * user triggered in the window — a server-side port of standup-prep Step 2a.
 * Team-service runs classify as service releases (Tag Release folded into the
 * release, collapsed by branch); library-repo runs classify as jar publishes.
 * A repo that errors (404, etc.) is skipped so one bad slug can't sink the sweep.
 */
export async function sweepGithub(
  token: string,
  org: string,
  login: string,
  teamServices: string[],
  libraryRepos: string[],
  window: DateWindow,
): Promise<GithubSweep> {
  const safe = (repo: string) =>
    sweepRepo(token, org, repo, login, window).catch(() => [] as GHARun[]);

  const [serviceRuns, libraryRuns] = await Promise.all([
    Promise.all(teamServices.map((r) => safe(r).then((runs) => [r, runs] as const))),
    Promise.all(libraryRepos.map((r) => safe(r).then((runs) => [r, runs] as const))),
  ]);

  const releases: ReleaseRun[] = [];
  for (const [repo, runs] of serviceRuns) {
    // Collapse runs by branch (version) so Tag Release + Release Production on
    // the same version tag become a single release item.
    const byBranch = new Map<string, GHARun[]>();
    for (const run of runs) {
      const arr = byBranch.get(run.head_branch) ?? [];
      arr.push(run);
      byBranch.set(run.head_branch, arr);
    }
    for (const [branch, group] of byBranch) {
      // Prefer a non-tag (e.g. "Release Production") run as the representative.
      const rep = group.find((r) => !isTagRun(r.name)) ?? group[0];
      releases.push({
        repo,
        version: branch || undefined,
        url: rep.html_url,
        at: rep.created_at,
      });
    }
  }

  const jarPublishes: JarPublish[] = [];
  for (const [repo, runs] of libraryRuns) {
    if (runs.length === 0) continue;
    jarPublishes.push({ repo, count: runs.length, url: runs[0].html_url });
  }

  return { releases, jarPublishes };
}
