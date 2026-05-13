import type {
  GitHubRepoConfig,
  GitHubTicketConfig,
  Issue,
  Workstream,
} from '../../../shared/types.ts';
import type { TicketProvider } from '../types.ts';

interface GitHubMilestone {
  number: number;
  title: string;
  state: string;
  created_at: string;
  due_on: string | null;
}

interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  closed_at: string | null;
  labels: Array<{ name: string }>;
  pull_request?: unknown;
}

interface GitHubRepo {
  name: string;
  created_at: string;
}

const day = (s: string | null | undefined): string | null => (s ? s.slice(0, 10) : null);

export class GitHubTicketProvider implements TicketProvider {
  private readonly headers: Record<string, string>;
  private readonly repos: GitHubRepoConfig[];

  constructor(cfg: GitHubTicketConfig) {
    this.repos = cfg.repos;
    this.headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}),
    };
  }

  private async ghget<T>(path: string): Promise<T> {
    const r = await fetch(`https://api.github.com${path}`, { headers: this.headers });
    if (!r.ok) {
      const body = (await r.text()).slice(0, 300);
      throw new Error(`GitHub ${r.status} ${path}: ${body}`);
    }
    return (await r.json()) as T;
  }

  private async fetchIssues(
    owner: string,
    repo: string,
    params: URLSearchParams,
  ): Promise<GitHubIssue[]> {
    const all: GitHubIssue[] = [];
    let page = 1;
    while (true) {
      params.set('per_page', '100');
      params.set('page', String(page));
      const batch = await this.ghget<GitHubIssue[]>(`/repos/${owner}/${repo}/issues?${params}`);
      // Filter out pull requests — GitHub returns PRs from the issues endpoint
      const issues = batch.filter((i) => !i.pull_request);
      all.push(...issues);
      if (batch.length < 100) break;
      page++;
    }
    return all;
  }

  private issueToShared(i: GitHubIssue): Issue {
    return {
      key: `#${i.number}`,
      summary: i.title,
      status: i.state,
      points: null,
      resolutiondate: day(i.closed_at),
      labels: i.labels.map((l) => l.name),
      components: [],
    };
  }

  private async fetchByMilestone(
    owner: string,
    repo: string,
    milestoneNumber: number,
  ): Promise<Workstream> {
    const [milestone, rawIssues] = await Promise.all([
      this.ghget<GitHubMilestone>(`/repos/${owner}/${repo}/milestones/${milestoneNumber}`),
      this.fetchIssues(
        owner,
        repo,
        new URLSearchParams({ milestone: String(milestoneNumber), state: 'all' }),
      ),
    ]);

    return {
      key: `${owner}/${repo}#${milestoneNumber}`,
      summary: milestone.title,
      status: milestone.state,
      created: day(milestone.created_at) ?? '',
      duedate: day(milestone.due_on),
      issues: rawIssues.map((i) => this.issueToShared(i)),
    };
  }

  private async fetchByRepo(owner: string, repo: string): Promise<Workstream> {
    const [repoMeta, rawIssues] = await Promise.all([
      this.ghget<GitHubRepo>(`/repos/${owner}/${repo}`),
      this.fetchIssues(owner, repo, new URLSearchParams({ state: 'all' })),
    ]);

    return {
      key: `${owner}/${repo}`,
      summary: repoMeta.name,
      status: 'open',
      created: day(repoMeta.created_at) ?? '',
      duedate: null,
      issues: rawIssues.map((i) => this.issueToShared(i)),
    };
  }

  async fetchWorkstreams(): Promise<Workstream[]> {
    const jobs: Promise<Workstream>[] = [];

    for (const { owner, repo, milestones } of this.repos) {
      if (milestones && milestones.length > 0) {
        for (const m of milestones) {
          jobs.push(this.fetchByMilestone(owner, repo, m));
        }
      } else {
        jobs.push(this.fetchByRepo(owner, repo));
      }
    }

    return Promise.all(jobs);
  }
}
