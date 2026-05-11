import type { Epic, Issue } from '../shared/types.ts';
import { config } from './config.ts';

const { base: JIRA_BASE, email: JIRA_EMAIL, apiToken: JIRA_TOKEN, spField: SP_FIELD } = config.jira;

if (!JIRA_EMAIL || !JIRA_TOKEN) {
  console.warn('jira.email and/or jira.api_token not set in config.toml — Jira calls will fail');
}

const auth = `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString('base64')}`;

interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    status: { name: string };
    created?: string;
    duedate?: string | null;
    resolutiondate?: string | null;
    labels?: string[];
    components?: Array<{ name: string }>;
    [k: string]: unknown;
  };
}

interface JiraSearchResponse {
  issues?: JiraIssue[];
}

const jget = async <T>(path: string): Promise<T> => {
  const r = await fetch(`${JIRA_BASE}${path}`, {
    headers: { Authorization: auth, Accept: 'application/json' },
  });
  if (!r.ok) {
    const body = (await r.text()).slice(0, 300);
    throw new Error(`${r.status} ${path}: ${body}`);
  }
  return (await r.json()) as T;
};

const day = (s: string | null | undefined): string | null => (s ? s.slice(0, 10) : null);

export const fetchEpic = async (key: string): Promise<Epic> => {
  const [meta, kids] = await Promise.all([
    jget<JiraIssue>(`/rest/api/3/issue/${key}?fields=summary,status,created,duedate`),
    jget<JiraSearchResponse>(
      `/rest/api/3/search/jql?${new URLSearchParams({
        jql: `parent = ${key}`,
        fields: `summary,status,resolutiondate,${SP_FIELD},labels,components`,
        maxResults: '100',
      })}`,
    ),
  ]);

  const issues: Issue[] = (kids.issues ?? []).map((i) => {
    const raw = i.fields[SP_FIELD];
    return {
      key: i.key,
      summary: i.fields.summary,
      status: i.fields.status.name,
      points: typeof raw === 'number' ? raw / 3600 : null,
      resolutiondate: day(i.fields.resolutiondate),
      labels: i.fields.labels ?? [],
      components: (i.fields.components ?? []).map((c) => c.name),
    };
  });

  return {
    key,
    summary: meta.fields.summary,
    status: meta.fields.status.name,
    created: day(meta.fields.created) ?? '',
    duedate: day(meta.fields.duedate),
    issues,
  };
};
