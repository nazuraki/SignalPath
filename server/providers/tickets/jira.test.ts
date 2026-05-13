import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JiraTicketConfig } from '../../../shared/types.ts';
import { JiraTicketProvider } from './jira.ts';

const cfg: JiraTicketConfig = {
  base: 'https://test.atlassian.net',
  email: 'test@example.com',
  apiToken: 'token123',
  spField: 'timeoriginalestimate',
  epics: ['PROJ-1'],
};

const makeMeta = () => ({
  key: 'PROJ-1',
  fields: {
    summary: 'My Epic',
    status: { name: 'In Progress' },
    created: '2025-01-01T00:00:00.000Z',
    duedate: '2025-03-01',
  },
});

const makeKids = () => ({
  issues: [
    {
      key: 'PROJ-2',
      fields: {
        summary: 'Child issue',
        status: { name: 'Done' },
        resolutiondate: '2025-01-15T00:00:00.000Z',
        timeoriginalestimate: 7200,
        labels: ['frontend'],
        components: [{ name: 'UI' }],
      },
    },
  ],
});

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('JiraTicketProvider.fetchWorkstreams', () => {
  it('maps Jira API response to Workstream[]', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify(makeMeta()), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(makeKids()), { status: 200 }));

    const provider = new JiraTicketProvider(cfg);
    const workstreams = await provider.fetchWorkstreams();

    expect(workstreams).toHaveLength(1);
    const ws = workstreams[0];
    expect(ws.key).toBe('PROJ-1');
    expect(ws.summary).toBe('My Epic');
    expect(ws.status).toBe('In Progress');
    expect(ws.created).toBe('2025-01-01');
    expect(ws.duedate).toBe('2025-03-01');
    expect(ws.issues).toHaveLength(1);

    const issue = ws.issues[0];
    expect(issue.key).toBe('PROJ-2');
    expect(issue.summary).toBe('Child issue');
    expect(issue.status).toBe('Done');
    expect(issue.points).toBe(2); // 7200 / 3600
    expect(issue.resolutiondate).toBe('2025-01-15');
    expect(issue.labels).toEqual(['frontend']);
    expect(issue.components).toEqual(['UI']);
  });

  it('throws a descriptive error on non-2xx Jira response', async () => {
    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(new Response('Unauthorized', { status: 401 })),
    );

    const provider = new JiraTicketProvider(cfg);
    await expect(provider.fetchWorkstreams()).rejects.toThrow('Jira 401');
  });

  it('handles missing kids gracefully', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(makeMeta()), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ issues: [] }), { status: 200 }));

    const provider = new JiraTicketProvider(cfg);
    const [ws] = await provider.fetchWorkstreams();
    expect(ws.issues).toEqual([]);
  });
});
