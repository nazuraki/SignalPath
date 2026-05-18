import { useEffect, useState } from 'react';
import type { ClientConfig, Workstream } from '../../shared/types.ts';
import CombinedChart from './components/CombinedChart.tsx';
import ParityMatrix from './components/ParityMatrix.tsx';
import PipelineStatus from './components/PipelineStatus.tsx';
import { computeBurndown, EPIC_COLORS, HOURS_PER_WEEK, remainingHours } from './lib/burndown.ts';
import { ConfigContext, DEFAULT_CONFIG } from './lib/config-context.ts';
import { fmt1 } from './lib/format.ts';

interface BurndownResponse {
  workstreams: Workstream[];
}

const MONO = '"JetBrains Mono", monospace';

export default function App() {
  const [config, setConfig] = useState<ClientConfig>(DEFAULT_CONFIG);
  const [data, setData] = useState<BurndownResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeWorkstream, setActiveWorkstream] = useState<string | null>(null);

  const fetchData = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/burndown');
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`HTTP ${r.status}: ${t.slice(0, 400)}`);
      }
      const parsed = (await r.json()) as BurndownResponse;
      if (!parsed.workstreams) throw new Error("Response missing 'workstreams'");
      let cursor = new Date();
      cursor.setHours(0, 0, 0, 0);
      for (const ws of parsed.workstreams) {
        const days = Math.ceil((remainingHours(ws) / HOURS_PER_WEEK) * 7);
        cursor = new Date(cursor.getTime() + days * 86400000);
        ws.projectedEnd = cursor.toISOString().slice(0, 10);
      }
      setData(parsed);
      setLastUpdated(new Date());
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json() as Promise<ClientConfig>)
      .then(setConfig)
      .catch((e) => console.error('config load failed', e));
    fetchData();
  }, []);

  const pairs = data
    ? data.workstreams.map((ws) => ({ workstream: ws, bd: computeBurndown(ws) }))
    : [];

  const totalRemaining = pairs.reduce((s, { bd }) => s + bd.remaining, 0);
  const totalPoints = pairs.reduce((s, { bd }) => s + bd.totalPoints, 0);
  const totalDone = pairs.reduce((s, { bd }) => s + bd.doneCount, 0);
  const totalIssues = pairs.reduce((s, { bd }) => s + bd.issueCount, 0);
  const stalledCount = pairs.filter(({ bd }) => bd.pctComplete > 0 && bd.pctComplete < 100).length;

  const handleRowClick = (key: string): void => {
    setActiveWorkstream(activeWorkstream === key ? null : key);
  };

  const parityWorkstream = config.parity.epic
    ? pairs.find((p) => p.workstream.key === config.parity.epic)?.workstream
    : undefined;

  return (
    <ConfigContext.Provider value={config}>
      <div className="min-h-screen" style={{ backgroundColor: '#131316', color: '#e4e1e5' }}>
        {/* Top app bar */}
        <header
          className="sticky top-0 z-40 flex items-center justify-between border-b"
          style={{
            backgroundColor: '#131316',
            borderColor: '#424754',
            height: 70,
            paddingLeft: 32,
            paddingRight: 32,
          }}
        >
          <div className="flex items-center gap-8 min-w-0">
            <h2
              className="font-semibold truncate"
              style={{
                color: '#adc6ff',
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: 20,
              }}
            >
              {config.ui.title}
            </h2>
            {config.ui.subtitle && (
              <span
                className="hidden md:inline uppercase tracking-[0.25em] text-neutral-500"
                style={{ fontFamily: MONO, fontSize: 13 }}
              >
                {config.ui.subtitle}
              </span>
            )}
            {data && stalledCount > 0 && (
              <span
                className="flex items-center gap-2 border"
                style={{
                  backgroundColor: '#ffb4ab14',
                  borderColor: '#ffb4ab33',
                  fontFamily: MONO,
                  padding: '4px 10px',
                }}
              >
                <span
                  className="rounded-full animate-pulse"
                  style={{ backgroundColor: '#ffb4ab', width: 8, height: 8 }}
                />
                <span
                  className="font-bold uppercase"
                  style={{ color: '#ffb4ab', fontSize: 13 }}
                >{`${stalledCount} active`}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-5" style={{ fontFamily: MONO }}>
            {data && pairs.length > 0 && (
              <span
                className="hidden md:inline text-neutral-500 tabular-nums"
                style={{ fontSize: 14 }}
              >
                <span className="text-amber-400">{fmt1(totalRemaining)}</span>
                <span className="text-neutral-600">{`/${Math.round(totalPoints)}h · `}</span>
                <span className="text-neutral-300">{totalDone}</span>
                <span className="text-neutral-600">{`/${totalIssues}`}</span>
              </span>
            )}
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="uppercase tracking-[0.25em] text-neutral-500 hover:text-[#adc6ff] disabled:opacity-30 transition-colors border"
              style={{ borderColor: '#424754', fontSize: 13, padding: '8px 16px' }}
            >
              {loading ? 'fetching…' : '↻ refresh'}
            </button>
          </div>
        </header>

        <main
          className="w-full"
          style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: 48 }}
        >
          {error && (
            <div
              className="border"
              style={{
                borderColor: '#ffb4ab55',
                backgroundColor: '#ffb4ab0a',
                color: '#ffb4ab',
                fontFamily: MONO,
                padding: 20,
              }}
            >
              <div
                className="uppercase tracking-wider opacity-70"
                style={{ fontSize: 13, marginBottom: 6 }}
              >
                load failed
              </div>
              <div className="whitespace-pre-wrap break-words" style={{ fontSize: 15 }}>
                {error}
              </div>
            </div>
          )}

          {loading && !data && (
            <div
              className="flex flex-col items-center justify-center text-neutral-500"
              style={{ paddingTop: 160, paddingBottom: 160 }}
            >
              <div
                className="border rounded-full animate-spin"
                style={{
                  borderColor: '#424754',
                  borderTopColor: '#adc6ff',
                  width: 40,
                  height: 40,
                  marginBottom: 20,
                }}
              />
              <p className="uppercase tracking-[0.25em]" style={{ fontFamily: MONO, fontSize: 13 }}>
                fetching…
              </p>
            </div>
          )}

          {data && pairs.length === 0 && (
            <div
              className="text-center text-neutral-600"
              style={{ fontFamily: MONO, paddingTop: 160, paddingBottom: 160 }}
            >
              <p className="uppercase tracking-widest" style={{ fontSize: 18 }}>
                no workstreams configured
              </p>
              <p className="text-neutral-700" style={{ fontSize: 13, marginTop: 10 }}>
                edit [tickets] in config.toml
              </p>
            </div>
          )}

          {data && pairs.length > 0 && (
            <>
              {/* Backpressure */}
              <section>
                <div
                  className="flex items-center justify-between"
                  style={{ paddingLeft: 6, marginBottom: 16 }}
                >
                  <div className="flex items-center gap-4">
                    <span style={{ width: 8, height: 8, backgroundColor: '#adc6ff' }} />
                    <span
                      className="uppercase tracking-[0.25em] text-neutral-500"
                      style={{ fontFamily: MONO, fontSize: 14 }}
                    >
                      Backpressure
                    </span>
                  </div>
                  <div className="flex items-center gap-4" style={{ fontFamily: MONO }}>
                    {pairs.map(({ workstream: ws }, i) => (
                      <button
                        type="button"
                        key={ws.key}
                        onClick={() => handleRowClick(ws.key)}
                        className="flex items-center gap-2 transition-opacity"
                        style={{
                          opacity: activeWorkstream && activeWorkstream !== ws.key ? 0.3 : 1,
                        }}
                      >
                        <span
                          style={{
                            width: 16,
                            height: 3,
                            backgroundColor: EPIC_COLORS[i % EPIC_COLORS.length],
                          }}
                        />
                        <span className="text-neutral-500" style={{ fontSize: 13 }}>
                          {ws.key}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div
                  className="border"
                  style={{
                    borderColor: '#424754',
                    backgroundColor: '#1b1b1e66',
                    height: 360,
                    padding: 10,
                  }}
                >
                  <CombinedChart pairs={pairs} activeWorkstream={activeWorkstream} />
                </div>
              </section>

              {/* Pipeline Status */}
              <PipelineStatus
                pairs={pairs}
                activeWorkstream={activeWorkstream}
                colors={EPIC_COLORS}
                onRowClick={handleRowClick}
              />

              {/* Parity Matrix */}
              {parityWorkstream && (
                <section>
                  <div
                    className="flex items-center gap-4"
                    style={{ paddingLeft: 6, marginBottom: 16 }}
                  >
                    <span style={{ width: 8, height: 8, backgroundColor: '#adc6ff' }} />
                    <span
                      className="uppercase tracking-[0.25em] text-neutral-500"
                      style={{ fontFamily: MONO, fontSize: 14 }}
                    >
                      Parity Matrix
                    </span>
                  </div>
                  <div
                    className="border"
                    style={{ borderColor: '#424754', backgroundColor: '#1b1b1e66' }}
                  >
                    <ParityMatrix workstream={parityWorkstream} />
                  </div>
                </section>
              )}
            </>
          )}

          {lastUpdated && (
            <p
              className="text-neutral-700 text-center tracking-widest"
              style={{ fontFamily: MONO, fontSize: 13 }}
            >
              {`updated ${lastUpdated.toLocaleTimeString()}`}
            </p>
          )}
        </main>
      </div>
    </ConfigContext.Provider>
  );
}
