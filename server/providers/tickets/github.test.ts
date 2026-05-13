import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitHubTicketConfig } from '../../../shared/types.ts';
import { GitHubTicketProvider } from './github.ts';

const cfg = (repos: GitHubTicketConfig['repos']): GitHubTicketConfig => ({
  token: 'ghp_test',
  repos,
});

const milestone = (overrides: object = {}) => ({
  number: 1,
  title: 'Sprint 1',
  state: 'open',
  created_at: '2025-01-01T00:00:00Z',
  due_on: '2025-02-01T00:00:00Z',
  ...overrides,
});

const ghIssue = (overrides: object = {}) => ({
  number: 42,
  title: 'Fix bug',
  state: 'closed',
  closed_at: '2025-01-10T00:00:00Z',
  labels: [{ name: 'bug' }],
  ...overrides,
});

const ghRepo = (overrides: object = {}) => ({
  name: 'backend',
  created_at: '2024-06-01T00:00:00Z',
  ...overrides,
});

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GitHubTicketProvider — milestone-based workstreams', () => {
  it('maps milestone + issues to a Workstream', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(milestone()), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([ghIssue()]), { status: 200 }));

    const provider = new GitHubTicketProvider(
      cfg([{ owner: 'myorg', repo: 'backend', milestones: [1] }]),
    );
    const workstreams = await provider.fetchWorkstreams();

    expect(workstreams).toHaveLength(1);
    const ws = workstreams[0];
    expect(ws.key).toBe('myorg/backend#1');
    expect(ws.summary).toBe('Sprint 1');
    expect(ws.status).toBe('open');
    expect(ws.created).toBe('2025-01-01');
    expect(ws.duedate).toBe('2025-02-01');
    expect(ws.issues).toHaveLength(1);

    const issue = ws.issues[0];
    expect(issue.key).toBe('#42');
    expect(issue.summary).toBe('Fix bug');
    expect(issue.status).toBe('closed');
    expect(issue.resolutiondate).toBe('2025-01-10');
    expect(issue.labels).toEqual(['bug']);
    expect(issue.points).toBeNull();
    expect(issue.components).toEqual([]);
  });

  it('throws a descriptive error on non-2xx GitHub response', async () => {
    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(new Response('Not Found', { status: 404 })),
    );

    const provider = new GitHubTicketProvider(
      cfg([{ owner: 'myorg', repo: 'backend', milestones: [1] }]),
    );
    await expect(provider.fetchWorkstreams()).rejects.toThrow('GitHub 404');
  });
});

describe('GitHubTicketProvider — repo-as-workstream (no milestones)', () => {
  it('maps repo metadata + all issues to a Workstream', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(ghRepo()), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([ghIssue()]), { status: 200 }));

    const provider = new GitHubTicketProvider(cfg([{ owner: 'myorg', repo: 'backend' }]));
    const workstreams = await provider.fetchWorkstreams();

    expect(workstreams).toHaveLength(1);
    const ws = workstreams[0];
    expect(ws.key).toBe('myorg/backend');
    expect(ws.summary).toBe('backend');
    expect(ws.status).toBe('open');
    expect(ws.created).toBe('2024-06-01');
    expect(ws.duedate).toBeNull();
  });

  it('filters out pull requests from issue list', async () => {
    const pr = { ...ghIssue(), pull_request: { url: 'https://api.github.com/...' } };
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(ghRepo()), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([ghIssue(), pr]), { status: 200 }));

    const provider = new GitHubTicketProvider(cfg([{ owner: 'myorg', repo: 'backend' }]));
    const [ws] = await provider.fetchWorkstreams();
    expect(ws.issues).toHaveLength(1);
  });
});

describe('GitHubTicketProvider — multi-repo fan-out', () => {
  it('returns one workstream per repo when no milestones', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(ghRepo({ name: 'backend' })), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(ghRepo({ name: 'frontend' })), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

    const provider = new GitHubTicketProvider(
      cfg([
        { owner: 'myorg', repo: 'backend' },
        { owner: 'myorg', repo: 'frontend' },
      ]),
    );
    const workstreams = await provider.fetchWorkstreams();
    expect(workstreams).toHaveLength(2);
    expect(workstreams.map((w) => w.key)).toEqual(['myorg/backend', 'myorg/frontend']);
  });
});
