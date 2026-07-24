import type { Issue, JiraTicketConfig, Workstream } from '../../../shared/types.ts';
import type { TicketProvider } from '../types.ts';
import { JiraClient } from './jira-client.ts';

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
  private readonly client: JiraClient;
  private readonly spField: string;
  private readonly spFieldFallback: string | undefined;
  private readonly epics: string[];

  constructor(cfg: JiraTicketConfig) {
    this.spField = cfg.spField;
    this.spFieldFallback = cfg.spFieldFallback;
    this.epics = cfg.epics;
    this.client = new JiraClient(cfg.base, cfg.email, cfg.apiToken);

    if (!cfg.email || !cfg.apiToken) {
      console.warn(
        'tickets.jira.email and/or tickets.jira.api_token not set — Jira calls will fail',
      );
    }
  }

  private async fetchEpic(key: string): Promise<Workstream> {
    const [meta, kids] = await Promise.all([
      this.client.get<JiraIssue>(`/rest/api/3/issue/${key}?fields=summary,status,created,duedate`),
      this.client.get<JiraSearchResponse>(
        `/rest/api/3/search/jql?${new URLSearchParams({
          jql: `parent = ${key}`,
          fields: [
            'summary',
            'status',
            'resolutiondate',
            this.spField,
            ...(this.spFieldFallback ? [this.spFieldFallback] : []),
            'labels',
            'components',
          ].join(','),
          maxResults: '100',
        })}`,
      ),
    ]);

    const issues: Issue[] = (kids.issues ?? []).map((i) => {
      const raw = i.fields[this.spField];
      const rawFallback = this.spFieldFallback ? i.fields[this.spFieldFallback] : undefined;
      const points =
        typeof raw === 'number' ? raw / 3600 : typeof rawFallback === 'number' ? rawFallback : null;
      return {
        key: i.key,
        summary: i.fields.summary,
        status: i.fields.status.name,
        points,
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
