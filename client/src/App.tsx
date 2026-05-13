import { useEffect, useState } from 'react';
import type { ClientConfig, Epic, StateMap, TicketState } from '../../shared/types.ts';
import CombinedChart from './components/CombinedChart.tsx';
import EpicStatsRow from './components/EpicStatsRow.tsx';
import TicketPanel from './components/TicketPanel.tsx';
import { computeBurndown, EPIC_COLORS, HOURS_PER_WEEK, remainingHours } from './lib/burndown.ts';
import { ConfigContext, DEFAULT_CONFIG } from './lib/config-context.ts';
import { fmt1 } from './lib/format.ts';

interface BurndownResponse {
  epics: Epic[];
}

export default function App() {
  const [config, setConfig] = useState<ClientConfig>(DEFAULT_CONFIG);
  const [data, setData] = useState<BurndownResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeEpic, setActiveEpic] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [state, setState] = useState<StateMap>({});

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
      if (!parsed.epics) throw new Error("Response missing 'epics'");
      let cursor = new Date();
      cursor.setHours(0, 0, 0, 0);
      for (const epic of parsed.epics) {
        const days = Math.ceil((remainingHours(epic) / HOURS_PER_WEEK) * 7);
        cursor = new Date(cursor.getTime() + days * 86400000);
        epic.projectedEnd = cursor.toISOString().slice(0, 10);
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

  const fetchState = async (): Promise<void> => {
    try {
      const r = await fetch('/api/state');
      if (r.ok) setState((await r.json()) as StateMap);
    } catch (e) {
      console.error('state load failed', e);
    }
  };

  const handleStateChange = async (key: string, patch: Partial<TicketState>): Promise<void> => {
    try {
      const r = await fetch(`/api/state/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (r.ok) setState((await r.json()) as StateMap);
    } catch (e) {
      console.error('state update failed', e);
    }
  };

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json() as Promise<ClientConfig>)
      .then(setConfig)
      .catch((e) => console.error('config load failed', e));
    fetchData();
    fetchState();
  }, []);

  const pairs = data ? data.epics.map((epic) => ({ epic, bd: computeBurndown(epic) })) : [];

  useEffect(() => {
    if (data && data.epics.length > 0 && !activeTab) {
      setActiveTab(data.epics[0].key);
    }
  }, [data, activeTab]);

  const totalRemaining = pairs.reduce((s, { bd }) => s + bd.remaining, 0);
  const totalPoints = pairs.reduce((s, { bd }) => s + bd.totalPoints, 0);
  const totalDone = pairs.reduce((s, { bd }) => s + bd.doneCount, 0);
  const totalIssues = pairs.reduce((s, { bd }) => s + bd.issueCount, 0);

  const handleRowClick = (key: string): void => {
    const next = activeEpic === key ? null : key;
    setActiveEpic(next);
    if (next) setActiveTab(next);
  };

  const handleTabChange = (key: string): void => {
    setActiveTab(key);
    setActiveEpic(key);
  };

  return (
    <ConfigContext.Provider value={config}>
      <div style={{ minHeight: '100vh' }}>
        <div className="max-w-6xl mx-auto px-6 py-12">
          <header className="mb-10 flex items-end justify-between gap-4 border-b border-neutral-800 pb-8">
            <div>
              {config.ui.subtitle && (
                <p
                  style={{ fontFamily: '"JetBrains Mono", monospace' }}
                  className="text-[11px] text-neutral-500 tracking-[0.25em] uppercase mb-3"
                >
                  {config.ui.subtitle}
                </p>
              )}
              <h1
                style={{
                  fontFamily: '"Newsreader", serif',
                  fontWeight: 500,
                  letterSpacing: '-0.02em',
                }}
                className="text-5xl text-neutral-50"
              >
                {config.ui.title}
              </h1>
              {data && pairs.length > 0 && (
                <p
                  className="mt-3 text-neutral-500"
                  style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '13px' }}
                >
                  {`${pairs.length} epics · `}
                  <span className="text-amber-400">{fmt1(totalRemaining)}</span>
                  <span className="text-neutral-600">{`/${Math.round(totalPoints)}h remaining · `}</span>
                  <span className="text-neutral-300">{totalDone}</span>
                  <span className="text-neutral-600">{`/${totalIssues} issues resolved`}</span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {activeEpic && (
                <button
                  type="button"
                  onClick={() => setActiveEpic(null)}
                  style={{ fontFamily: '"JetBrains Mono", monospace' }}
                  className="text-[11px] uppercase tracking-[0.2em] text-neutral-600 hover:text-neutral-300 transition-colors px-3 py-2 border border-neutral-800 hover:border-neutral-600"
                >
                  clear ×
                </button>
              )}
              <button
                type="button"
                onClick={fetchData}
                disabled={loading}
                style={{ fontFamily: '"JetBrains Mono", monospace' }}
                className="text-[11px] uppercase tracking-[0.25em] text-neutral-500 hover:text-amber-400 disabled:opacity-30 transition-colors px-3 py-2 border border-neutral-800 hover:border-amber-400/40"
              >
                {loading ? 'fetching…' : '↻ refresh'}
              </button>
            </div>
          </header>

          {error && (
            <div className="border border-rose-900/60 bg-rose-950/20 text-rose-200 p-6 mb-8">
              <p className="font-medium mb-2" style={{ fontFamily: '"Newsreader", serif' }}>
                Failed to load
              </p>
              <p
                className="text-xs whitespace-pre-wrap break-words"
                style={{ fontFamily: '"JetBrains Mono", monospace' }}
              >
                {error}
              </p>
            </div>
          )}

          {loading && !data && (
            <div className="flex flex-col items-center justify-center py-32 text-neutral-500">
              <div className="w-10 h-10 border border-neutral-800 border-t-amber-400 rounded-full animate-spin mb-6" />
              <p
                style={{ fontFamily: '"JetBrains Mono", monospace' }}
                className="text-[11px] uppercase tracking-[0.25em]"
              >
                fetching from jira…
              </p>
            </div>
          )}

          {data && pairs.length === 0 && (
            <div className="text-center py-32">
              <p
                style={{ fontFamily: '"Newsreader", serif', fontStyle: 'italic' }}
                className="text-2xl text-neutral-500"
              >
                No epics configured.
              </p>
              <p
                style={{ fontFamily: '"JetBrains Mono", monospace' }}
                className="text-xs text-neutral-700 mt-3 tracking-wider"
              >
                edit [jira].epics in config.toml
              </p>
            </div>
          )}

          {data && pairs.length > 0 && (
            <div className="space-y-6">
              <div className="border border-neutral-800 bg-neutral-950/40">
                <div className="px-6 pt-5 pb-1 flex items-center justify-between">
                  <span
                    style={{ fontFamily: '"JetBrains Mono", monospace' }}
                    className="text-[10px] uppercase tracking-[0.25em] text-neutral-600"
                  >
                    hours remaining
                  </span>
                  <div className="flex items-center gap-3">
                    {pairs.map(({ epic }, i) => (
                      <button
                        type="button"
                        key={epic.key}
                        onClick={() => handleRowClick(epic.key)}
                        className="flex items-center gap-1.5 transition-opacity"
                        style={{
                          opacity: activeEpic && activeEpic !== epic.key ? 0.3 : 1,
                        }}
                      >
                        <span
                          className="w-3 h-0.5"
                          style={{ backgroundColor: EPIC_COLORS[i % EPIC_COLORS.length] }}
                        />
                        <span
                          style={{
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: '10px',
                            color: '#71717a',
                          }}
                        >
                          {epic.key}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-72 px-3 pt-1 pb-1">
                  <CombinedChart pairs={pairs} activeEpic={activeEpic} />
                </div>
                <div className="border-t border-neutral-900">
                  {pairs.map(({ epic, bd }, i) => (
                    <EpicStatsRow
                      key={epic.key}
                      epic={epic}
                      bd={bd}
                      color={EPIC_COLORS[i % EPIC_COLORS.length]}
                      isActive={activeEpic === epic.key}
                      isAnyActive={activeEpic !== null}
                      onClick={() => handleRowClick(epic.key)}
                    />
                  ))}
                </div>
              </div>

              {activeTab && (
                <TicketPanel
                  pairs={pairs}
                  activeTab={activeTab}
                  onTabChange={handleTabChange}
                  state={state}
                  onStateChange={handleStateChange}
                />
              )}
            </div>
          )}

          {lastUpdated && (
            <p
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
              className="mt-12 text-[11px] text-neutral-700 text-center tracking-widest"
            >
              {`updated ${lastUpdated.toLocaleTimeString()}`}
            </p>
          )}
        </div>
      </div>
    </ConfigContext.Provider>
  );
}
