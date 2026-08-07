import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GrafanaMetricsConfig } from '../../../shared/types.ts';
import { applyTemplate, extractValue, GrafanaMetricsProvider } from './grafana.ts';

const cfg = (overrides: Partial<GrafanaMetricsConfig> = {}): GrafanaMetricsConfig => ({
  base: 'https://grafana.example.com',
  token: 'glsa_test',
  datasourceUid: 'prom-uid',
  dashboardUrl: 'https://grafana.example.com/d/abc/svc?var-service={{svc}}&var-ns={{namespace}}',
  dashboards: {},
  window: '15m',
  queries: [
    { key: 'p99', label: 'p99', expr: 'q{namespace="{{namespace}}"}', unit: 'ms' },
    { key: 'rps', label: 'rps', expr: 'r{svc="{{svc}}"}' },
  ],
  ...overrides,
});

const frame = (values: unknown[][]) => ({
  schema: {
    fields: [
      { name: 'Time', type: 'time' },
      { name: 'Value', type: 'number' },
    ],
  },
  data: { values },
});

const ok = (body: unknown) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('applyTemplate', () => {
  it('substitutes svc and namespace, tolerating inner whitespace', () => {
    expect(applyTemplate('{{svc}}/{{ namespace }}', 'svc-a', 'ns-a')).toBe('svc-a/ns-a');
  });

  it('substitutes every occurrence', () => {
    expect(applyTemplate('{{svc}}-{{svc}}', 'a', 'n')).toBe('a-a');
  });
});

describe('extractValue', () => {
  it('takes the last non-null number from the schema-declared numeric field', () => {
    expect(
      extractValue([
        frame([
          [1, 2, 3],
          [10, 20, 42],
        ]),
      ]),
    ).toBe(42);
  });

  it('skips trailing nulls', () => {
    expect(
      extractValue([
        frame([
          [1, 2],
          [7, null],
        ]),
      ]),
    ).toBe(7);
  });

  it('falls back to the second column when the schema is absent', () => {
    expect(extractValue([{ data: { values: [[1], [5]] } }])).toBe(5);
  });

  it('returns null for empty, absent, or all-null frames', () => {
    expect(extractValue(undefined)).toBeNull();
    expect(extractValue([])).toBeNull();
    expect(extractValue([frame([[1], [null]])])).toBeNull();
  });
});

describe('GrafanaMetricsProvider.dashboardUrl', () => {
  it('builds from the template', () => {
    expect(new GrafanaMetricsProvider(cfg()).dashboardUrl('svc-a', 'ns-a')).toBe(
      'https://grafana.example.com/d/abc/svc?var-service=svc-a&var-ns=ns-a',
    );
  });

  it('prefers a per-service override', () => {
    const provider = new GrafanaMetricsProvider(
      cfg({ dashboards: { 'svc-a': 'https://g/d/only-a' } }),
    );
    expect(provider.dashboardUrl('svc-a', 'ns-a')).toBe('https://g/d/only-a');
    expect(provider.dashboardUrl('svc-b', 'ns-b')).toContain('var-service=svc-b');
  });

  it('returns null when no template is configured', () => {
    expect(
      new GrafanaMetricsProvider(cfg({ dashboardUrl: undefined })).dashboardUrl('a', 'n'),
    ).toBeNull();
  });
});

describe('GrafanaMetricsProvider.fetchMetrics', () => {
  it('posts one query per configured tile with substituted expressions', async () => {
    const mock = vi.mocked(fetch);
    mock.mockResolvedValue(
      ok({ results: { q0: { frames: [frame([[1], [84.2]])] }, q1: { frames: [] } } }) as never,
    );

    const values = await new GrafanaMetricsProvider(cfg()).fetchMetrics('svc-a', 'ns-a');

    const [url, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://grafana.example.com/api/ds/query');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer glsa_test');
    const body = JSON.parse(init.body as string);
    expect(body.from).toBe('now-15m');
    expect(body.queries).toHaveLength(2);
    expect(body.queries[0]).toMatchObject({
      refId: 'q0',
      expr: 'q{namespace="ns-a"}',
      instant: true,
      datasource: { uid: 'prom-uid' },
    });
    expect(body.queries[1].expr).toBe('r{svc="svc-a"}');

    expect(values[0]).toEqual({ key: 'p99', label: 'p99', unit: 'ms', value: 84.2 });
    // A tile with no series reports "no data" rather than a zero.
    expect(values[1]).toEqual({
      key: 'rps',
      label: 'rps',
      unit: undefined,
      value: null,
      error: 'no data',
    });
  });

  it('surfaces a per-query error without blanking the other tiles', async () => {
    vi.mocked(fetch).mockResolvedValue(
      ok({
        results: {
          q0: { error: 'parse error: unexpected }' },
          q1: { frames: [frame([[1], [3]])] },
        },
      }) as never,
    );

    const values = await new GrafanaMetricsProvider(cfg()).fetchMetrics('svc-a', 'ns-a');
    expect(values[0]).toMatchObject({ value: null, error: 'parse error: unexpected }' });
    expect(values[1]).toMatchObject({ value: 3 });
  });

  it('fails every tile with the HTTP status on a non-2xx response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('unauthorized'),
    } as never);

    const values = await new GrafanaMetricsProvider(cfg()).fetchMetrics('svc-a', 'ns-a');
    expect(values).toHaveLength(2);
    for (const v of values) {
      expect(v.value).toBeNull();
      expect(v.error).toContain('Grafana HTTP 401');
    }
  });

  it('resolves rather than rejecting when the request throws', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('ECONNREFUSED'));
    const values = await new GrafanaMetricsProvider(cfg()).fetchMetrics('svc-a', 'ns-a');
    expect(values.every((v) => v.value === null && v.error === 'ECONNREFUSED')).toBe(true);
  });

  it('makes no request when no queries are configured', async () => {
    const values = await new GrafanaMetricsProvider(cfg({ queries: [] })).fetchMetrics('a', 'n');
    expect(values).toEqual([]);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});
