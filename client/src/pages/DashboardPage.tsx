import CombinedChart from '../components/CombinedChart.tsx';
import DataGate from '../components/DataGate.tsx';
import PipelineStatus from '../components/PipelineStatus.tsx';
import WarningBanner from '../components/WarningBanner.tsx';
import { EPIC_COLORS } from '../lib/burndown.ts';
import { useDashboard } from '../lib/dashboard-context.ts';
import { countMissingLOE } from '../lib/loe.ts';

const MONO = '"JetBrains Mono", monospace';

export default function DashboardPage() {
  const { pairs, loading, error, activeWorkstream, setActiveWorkstream } = useDashboard();

  const missingLOE = countMissingLOE(pairs);

  const handleRowClick = (key: string): void => {
    setActiveWorkstream(activeWorkstream === key ? null : key);
  };

  return (
    <DataGate loading={loading} error={error} empty={pairs.length === 0}>
      {pairs.length === 0 ? (
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
      ) : (
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
                    style={{ opacity: activeWorkstream && activeWorkstream !== ws.key ? 0.3 : 1 }}
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
            {missingLOE.unresolved > 0 && (
              <WarningBanner>
                {`${missingLOE.unresolved} unresolved ticket${missingLOE.unresolved === 1 ? '' : 's'} missing LOE — burndown estimate may be inaccurate`}
              </WarningBanner>
            )}
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
        </>
      )}
    </DataGate>
  );
}
