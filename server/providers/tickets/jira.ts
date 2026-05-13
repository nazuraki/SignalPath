import type { Issue, JiraTicketConfig, Workstream } from '../../../shared/types.ts';
import type { TicketProvider } from '../types.ts';

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

const day = (s: string | null | undefined): string | null => (s ? s.slice(0, 10) : null);

export class JiraTicketProvider implements TicketProvider {
  private readonly auth: string;
  private readonly base: string;
  private readonly spField: string;
  private readonly epics: string[];

  constructor(cfg: JiraTicketConfig) {
    this.base = cfg.base;
    this.spField = cfg.spField;
    this.epics = cfg.epics;
    this.auth = `Basic ${Buffer.from(`${cfg.email}:${cfg.apiToken}`).toString('base64')}`;

    if (!cfg.email || !cfg.apiToken) {
      console.warn(
        'tickets.jira.email and/or tickets.jira.api_token not set — Jira calls will fail',
      );
    }
  }

  private async jget<T>(path: string): Promise<T> {
    const r = await fetch(`${this.base}${path}`, {
      headers: { Authorization: this.auth, Accept: 'application/json' },
    });
    if (!r.ok) {
      const body = (await r.text()).slice(0, 300);
      throw new Error(`Jira ${r.status} ${path}: ${body}`);
    }
    return (await r.json()) as T;
  }

  private async fetchEpic(key: string): Promise<Workstream> {
    const [meta, kids] = await Promise.all([
      this.jget<JiraIssue>(`/rest/api/3/issue/${key}?fields=summary,status,created,duedate`),
      this.jget<JiraSearchResponse>(
        `/rest/api/3/search/jql?${new URLSearchParams({
          jql: `parent = ${key}`,
          fields: `summary,status,resolutiondate,${this.spField},labels,components`,
          maxResults: '100',
        })}`,
      ),
    ]);

    const issues: Issue[] = (kids.issues ?? []).map((i) => {
      const raw = i.fields[this.spField];
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
  }

  async fetchWorkstreams(): Promise<Workstream[]> {
    return Promise.all(this.epics.map((key) => this.fetchEpic(key)));
  }
}
