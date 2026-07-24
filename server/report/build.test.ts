import { describe, expect, it } from 'vitest';
import { buildReport } from './build.ts';
import type { DateWindow } from './dateWindow.ts';
import type { GithubSweep } from './github.ts';
import type { JiraActivityItem } from './jira.ts';
import type { SlackSignals } from './slack.ts';

const emptySlack = (): SlackSignals => ({
  releasePosts: [],
  mentions: [],
  reactions: [],
  selfMessages: [],
  warnings: [],
});

const emptyGithub = (): GithubSweep => ({ releases: [], jarPublishes: [] });

const window = (over: Partial<DateWindow> = {}): DateWindow => ({
  startDate: '2026-07-22',
  endDate: '2026-07-22',
  isFriday: false,
  ...over,
});

const base = {
  window: window(),
  jiraItems: [] as JiraActivityItem[],
  github: emptyGithub(),
  slack: emptySlack(),
  jiraBase: 'https://example.atlassian.net',
};

describe('buildReport grouping', () => {
  it('groups Jira items by epic in first-seen order', () => {
    const jiraItems: JiraActivityItem[] = [
      { key: 'COP-1', summary: 'A', status: 'Done', epicKey: 'COP-100', epicName: 'Epic One' },
      {
        key: 'COP-2',
        summary: 'B',
        status: 'In Progress',
        epicKey: 'COP-200',
        epicName: 'Epic Two',
      },
      { key: 'COP-3', summary: 'C', status: 'Done', epicKey: 'COP-100', epicName: 'Epic One' },
    ];
    const r = buildReport({ ...base, jiraItems });
    expect(r.groups.map((g) => g.name)).toEqual(['Epic One', 'Epic Two']);
    expect(r.groups[0].items).toHaveLength(2);
    expect(r.groups[0].epicKey).toBe('COP-100');
  });

  it('files epic-less issues under "No epic"', () => {
    const jiraItems: JiraActivityItem[] = [{ key: 'COP-9', summary: 'X', status: 'To Do' }];
    const r = buildReport({ ...base, jiraItems });
    expect(r.groups[0].name).toBe('No epic');
    expect(r.groups[0].epicKey).toBeUndefined();
  });
});

describe('buildReport GitHub classification', () => {
  it('renders library runs as jar publishes and service runs as releases', () => {
    const github: GithubSweep = {
      releases: [
        { repo: 'gocart', version: 'v1.2.0', url: 'https://run/1', at: '2026-07-22T10:00:00Z' },
      ],
      jarPublishes: [{ repo: 'gorules', count: 3, url: 'https://run/2' }],
    };
    const r = buildReport({ ...base, github });
    // These assertions verify the formatting logic (verb + pluralization),
    // not merely a snapshot of current output.
    expect(r.slackText).toContain('released *gocart* v1.2.0');
    expect(r.slackText).toContain('published 3 updated jars — *gorules*');
    expect(r.slackText).not.toContain('released *gorules*');
  });

  it('singularizes a single jar publish', () => {
    const github: GithubSweep = {
      releases: [],
      jarPublishes: [{ repo: 'gorules', count: 1, url: 'https://run/2' }],
    };
    const r = buildReport({ ...base, github });
    expect(r.slackText).toContain('published 1 updated jar — *gorules*');
  });
});

describe('buildReport Friday rule', () => {
  it('does not label service runs as releases on a Friday and warns', () => {
    const github: GithubSweep = {
      releases: [
        { repo: 'gocart', version: 'v1.2.0', url: 'https://run/1', at: '2026-07-24T10:00:00Z' },
      ],
      jarPublishes: [],
    };
    const r = buildReport({ ...base, window: window({ isFriday: true }), github });
    expect(r.slackText).not.toContain('released');
    expect(r.slackText).toContain('deploy activity on *gocart*');
    expect(r.warnings.some((w) => w.includes('Friday'))).toBe(true);
  });
});

describe('buildReport Slack activity', () => {
  it('merges mentions and self messages, deduping by permalink', () => {
    const slack: SlackSignals = {
      ...emptySlack(),
      mentions: [{ text: 'ping', permalink: 'https://s/1', channel: 'c', username: 'u', ts: '1' }],
      selfMessages: [
        { text: 'ping', permalink: 'https://s/1', channel: 'c', username: 'u', ts: '1' },
        { text: 'note', permalink: 'https://s/2', channel: 'c', username: 'u', ts: '2' },
      ],
    };
    const r = buildReport({ ...base, slack });
    const group = r.groups.find((g) => g.name === 'Slack activity');
    expect(group?.items).toHaveLength(2);
  });

  it('propagates gathered Slack warnings', () => {
    const slack: SlackSignals = {
      ...emptySlack(),
      warnings: ['Slack mentions search failed: bad'],
    };
    const r = buildReport({ ...base, slack });
    expect(r.warnings).toContain('Slack mentions search failed: bad');
  });
});

describe('buildReport Slack draft', () => {
  it('hyperlinks ticket keys and epic headers', () => {
    const jiraItems: JiraActivityItem[] = [
      {
        key: 'COP-1',
        summary: 'Fix thing',
        status: 'Done',
        epicKey: 'COP-100',
        epicName: 'Epic One',
      },
    ];
    const r = buildReport({ ...base, jiraItems });
    expect(r.slackText).toContain(
      '_Epic One (<https://example.atlassian.net/browse/COP-100|COP-100>)_',
    );
    expect(r.slackText).toContain('<https://example.atlassian.net/browse/COP-1|COP-1>');
    // Blank line between header and first bullet (standup-prep formatting rule).
    expect(r.slackText).toContain('|COP-100>)_\n\n• ');
  });

  it('returns a placeholder when there is no activity', () => {
    const r = buildReport(base);
    expect(r.groups).toHaveLength(0);
    expect(r.slackText).toBe('No activity found for 2026-07-22.');
  });
});
