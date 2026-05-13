import { describe, expect, it } from 'vitest';
import type { TicketsConfig } from '../../shared/types.ts';
import { createTicketProvider } from './registry.ts';
import { GitHubTicketProvider } from './tickets/github.ts';
import { JiraTicketProvider } from './tickets/jira.ts';
import { NullTicketProvider } from './tickets/null.ts';

const jiraConfig: TicketsConfig = {
  provider: 'jira',
  jira: {
    base: 'https://x.atlassian.net',
    email: 'a@b.com',
    apiToken: 't',
    spField: 'sp',
    epics: [],
  },
};

const githubConfig: TicketsConfig = {
  provider: 'github',
  github: { token: 'ghp_test', repos: [{ owner: 'org', repo: 'repo' }] },
};

describe('createTicketProvider', () => {
  it('returns JiraTicketProvider for provider = "jira"', () => {
    expect(createTicketProvider(jiraConfig)).toBeInstanceOf(JiraTicketProvider);
  });

  it('returns GitHubTicketProvider for provider = "github"', () => {
    expect(createTicketProvider(githubConfig)).toBeInstanceOf(GitHubTicketProvider);
  });

  it('returns NullTicketProvider for provider = "none"', () => {
    expect(createTicketProvider({ provider: 'none' })).toBeInstanceOf(NullTicketProvider);
  });

  it('throws when jira provider config is missing', () => {
    expect(() => createTicketProvider({ provider: 'jira' })).toThrow('[tickets.jira]');
  });

  it('throws when github provider config is missing', () => {
    expect(() => createTicketProvider({ provider: 'github' })).toThrow('[tickets.github]');
  });
});

describe('NullTicketProvider', () => {
  it('returns an empty array', async () => {
    const provider = new NullTicketProvider();
    await expect(provider.fetchWorkstreams()).resolves.toEqual([]);
  });
});
