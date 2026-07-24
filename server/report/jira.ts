import type { JiraClient } from '../providers/tickets/jira-client.ts';
import { type DateWindow, nextDay } from './dateWindow.ts';

/** A Jira issue the user touched during the window, with its epic for grouping. */
export interface JiraActivityItem {
  key: string;
  summary: string;
  status: string;
  epicKey?: string;
  epicName?: string;
}

interface JiraSearchIssue {
  key: string;
  fields: {
    summary: string;
    status: { name: string };
    parent?: { key: string; fields?: { summary?: string } };
  };
}

interface JiraSearchResponse {
  issues?: JiraSearchIssue[];
}

/**
 * Fetch issues the user was involved with (assignee / reporter / watcher) that
 * were updated during the window — the standup-prep Step 1 JQL searches.
 * Results are merged and deduplicated by key. The epic (Jira `parent`) is
 * carried through for grouping.
 */
export async function fetchJiraActivity(
  client: JiraClient,
  project: string,
  accountId: string,
  window: DateWindow,
): Promise<JiraActivityItem[]> {
  const upper = nextDay(window.endDate); // exclusive: updated < day-after-end
  const clauses = [
    `assignee = "${accountId}"`,
    `reporter = "${accountId}"`,
    `watcher = "${accountId}"`,
  ];

  const responses = await Promise.all(
    clauses.map((clause) => {
      const jql =
        `project = ${project} AND ${clause} ` +
        `AND updated >= "${window.startDate}" AND updated < "${upper}"`;
      const qs = new URLSearchParams({
        jql,
        fields: 'summary,status,parent',
        maxResults: '50',
      });
      return client.get<JiraSearchResponse>(`/rest/api/3/search/jql?${qs}`);
    }),
  );

  const byKey = new Map<string, JiraActivityItem>();
  for (const resp of responses) {
    for (const issue of resp.issues ?? []) {
      if (byKey.has(issue.key)) continue;
      byKey.set(issue.key, {
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status.name,
        epicKey: issue.fields.parent?.key,
        epicName: issue.fields.parent?.fields?.summary,
      });
    }
  }
  return [...byKey.values()];
}
