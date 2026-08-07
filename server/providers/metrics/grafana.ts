import type { GrafanaMetricsConfig, MetricValue } from '../../../shared/types.ts';
import type { MetricsProvider } from '../types.ts';

/** Substitute `{{svc}}` / `{{namespace}}` (tolerating inner whitespace) in a template. */
export function applyTemplate(template: string, svcKey: string, namespace: string): string {
  return template
    .replace(/\{\{\s*svc\s*\}\}/g, svcKey)
    .replace(/\{\{\s*namespace\s*\}\}/g, namespace);
}

/** One frame of a Grafana data response. */
interface Frame {
  schema?: { fields?: Array<{ name?: string; type?: string }> };
  data?: { values?: unknown[][] };
}

interface DsQueryResponse {
  results?: Record<string, { frames?: Frame[]; error?: string; status?: number }>;
  message?: string;
}

/**
 * Pull the current value out of a Grafana frame set: the last non-null number in
 * the first numeric field. Instant Prometheus queries return a single row, but
 * a range-ish response is handled the same way by taking the newest point.
 */
export function extractValue(frames: Frame[] | undefined): number | null {
  for (const frame of frames ?? []) {
    const values = frame.data?.values;
    if (!Array.isArray(values) || values.length === 0) continue;

    // Prefer the column the schema declares numeric; fall back to the second
    // column, which is where Prometheus puts the value after the timestamp.
    const fields = frame.schema?.fields;
    let col = -1;
    if (Array.isArray(fields)) {
      col = fields.findIndex((f) => f?.type === 'number');
    }
    if (col < 0) col = values.length > 1 ? 1 : 0;

    const column = values[col];
    if (!Array.isArray(column)) continue;
    for (let i = column.length - 1; i >= 0; i--) {
      const v = column[i];
      if (typeof v === 'number' && Number.isFinite(v)) return v;
    }
  }
  return null;
}

/**
 * Queries Prometheus through Grafana's datasource proxy (`POST /api/ds/query`),
 * so one Grafana base URL + service-account token covers both the dashboard deep
 * links and the live numbers — Prometheus itself need not be reachable.
 *
 * The token stays server-side; only `dashboardUrl` output is sent to the client.
 */
export class GrafanaMetricsProvider implements MetricsProvider {
  readonly name = 'grafana';

  private readonly cfg: GrafanaMetricsConfig;

  constructor(cfg: GrafanaMetricsConfig) {
    this.cfg = cfg;
  }

  dashboardUrl(svcKey: string, namespace: string): string | null {
    const template = this.cfg.dashboards[svcKey] ?? this.cfg.dashboardUrl;
    if (!template) return null;
    return applyTemplate(template, svcKey, namespace);
  }

  async fetchMetrics(svcKey: string, namespace: string): Promise<MetricValue[]> {
    const { queries } = this.cfg;
    if (queries.length === 0) return [];

    // refIds are positional so a config key with punctuation can't confuse Grafana.
    const refIdOf = (i: number): string => `q${i}`;
    const base = queries.map((q) => ({ key: q.key, label: q.label, unit: q.unit }));
    const failAll = (error: string): MetricValue[] =>
      base.map((b) => ({ ...b, value: null, error }));

    let body: DsQueryResponse;
    try {
      const r = await fetch(`${this.cfg.base.replace(/\/$/, '')}/api/ds/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.cfg.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `now-${this.cfg.window}`,
          to: 'now',
          queries: queries.map((q, i) => ({
            refId: refIdOf(i),
            datasource: { uid: this.cfg.datasourceUid, type: 'prometheus' },
            expr: applyTemplate(q.expr, svcKey, namespace),
            instant: true,
            maxDataPoints: 1,
            intervalMs: 60_000,
          })),
        }),
      });
      if (!r.ok) {
        const text = await r.text();
        return failAll(`Grafana HTTP ${r.status}: ${text.slice(0, 120)}`);
      }
      body = (await r.json()) as DsQueryResponse;
    } catch (e) {
      return failAll((e as Error).message);
    }

    return base.map((meta, i) => {
      const result = body.results?.[refIdOf(i)];
      if (!result) return { ...meta, value: null, error: 'no result returned' };
      // Grafana reports a bad expression per-query rather than failing the request.
      if (result.error) return { ...meta, value: null, error: result.error };
      const value = extractValue(result.frames);
      return value === null ? { ...meta, value: null, error: 'no data' } : { ...meta, value };
    });
  }
}
