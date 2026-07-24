/**
 * Minimal authenticated Jira REST client. Shared by the ticket provider and the
 * workday-report Jira module so the auth header + error shape live in one place.
 */
export class JiraClient {
  private readonly auth: string;
  private readonly base: string;

  constructor(base: string, email: string, apiToken: string) {
    this.base = base;
    this.auth = `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`;
  }

  async get<T>(path: string): Promise<T> {
    const r = await fetch(`${this.base}${path}`, {
      headers: { Authorization: this.auth, Accept: 'application/json' },
    });
    if (!r.ok) {
      const body = (await r.text()).slice(0, 300);
      throw new Error(`Jira ${r.status} ${path}: ${body}`);
    }
    return (await r.json()) as T;
  }
}
