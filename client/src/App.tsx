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

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export default function App() {
  const [config, setConfig] = useState<ClientConfig>(DEFAULT_CONFIG);
  const [data, setData] = useState<BurndownResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeWorkstream, setActiveWorkstream] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(
    () => localStorage.getItem('theme') !== 'light',
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

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
      <div className="min-h-screen" style={{ backgroundColor: 'var(--c-bg)', color: 'var(--c-text)' }}>
        {/* Top app bar */}
        <header
          className="sticky top-0 z-40 flex items-center justify-between border-b"
          style={{
            backgroundColor: 'var(--c-bg)',
            borderColor: 'var(--c-border)',
            height: 70,
            paddingLeft: 32,
            paddingRight: 32,
          }}
        >
          <div className="flex items-center gap-8 min-w-0">
            <h2
              className="font-semibold truncate"
              style={{
                color: 'var(--c-accent)',
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
                  backgroundColor: 'var(--c-error-bg)',
                  borderColor: 'var(--c-error-border)',
                  fontFamily: MONO,
                  padding: '4px 10px',
                }}
              >
                <span
                  className="rounded-full animate-pulse"
                  style={{ backgroundColor: 'var(--c-error)', width: 8, height: 8 }}
                />
                <span
                  className="font-bold uppercase"
                  style={{ color: 'var(--c-error)', fontSize: 13 }}
                >{`${stalledCount} active`}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-3" style={{ fontFamily: MONO }}>
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
              onClick={() => setDarkMode(!darkMode)}
              className="icon-btn text-neutral-500 border flex items-center justify-center"
              style={{ borderColor: 'var(--c-border)', padding: '8px 10px' }}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <SunIcon /> : <MoonIcon />}
            </button>
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="icon-btn uppercase tracking-[0.25em] text-neutral-500 disabled:opacity-30 border"
              style={{ borderColor: 'var(--c-border)', fontSize: 13, padding: '8px 16px' }}
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
                borderColor: 'var(--c-error-border)',
                backgroundColor: 'var(--c-error-bg)',
                color: 'var(--c-error)',
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
                  borderColor: 'var(--c-border)',
                  borderTopColor: 'var(--c-accent)',
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
                    <span style={{ width: 8, height: 8, backgroundColor: 'var(--c-accent)' }} />
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
                          {ws.key.split('/').pop() || ws.key}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div
                  className="border"
                  style={{
                    borderColor: 'var(--c-border)',
                    backgroundColor: 'var(--c-bg-card-60)',
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
                    <span style={{ width: 8, height: 8, backgroundColor: 'var(--c-accent)' }} />
                    <span
                      className="uppercase tracking-[0.25em] text-neutral-500"
                      style={{ fontFamily: MONO, fontSize: 14 }}
                    >
                      Parity Matrix
                    </span>
                  </div>
                  <div
                    className="border"
                    style={{ borderColor: 'var(--c-border)', backgroundColor: 'var(--c-bg-card-60)' }}
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
