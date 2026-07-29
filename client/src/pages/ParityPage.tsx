import DataGate from '../components/DataGate.tsx';
import ParityMatrix from '../components/ParityMatrix.tsx';
import { useConfig } from '../lib/config-context.ts';
import { useDashboard } from '../lib/dashboard-context.ts';

const MONO = '"JetBrains Mono", monospace';

export default function ParityPage() {
  const config = useConfig();
  const { pairs, loading, error } = useDashboard();

  const parityWorkstream = config.parity.epic
    ? pairs.find((p) => p.workstream.key === config.parity.epic)?.workstream
    : undefined;

  return (
    <DataGate loading={loading} error={error} empty={pairs.length === 0 && !!config.parity.epic}>
      <section>
        <div className="flex items-center gap-4" style={{ paddingLeft: 6, marginBottom: 16 }}>
          <span style={{ width: 8, height: 8, backgroundColor: 'var(--c-accent)' }} />
          <span
            className="uppercase tracking-[0.25em] text-neutral-500"
            style={{ fontFamily: MONO, fontSize: 14 }}
          >
            Parity Matrix
          </span>
        </div>
        {parityWorkstream ? (
          <div
            className="border"
            style={{ borderColor: 'var(--c-border)', backgroundColor: 'var(--c-bg-card-60)' }}
          >
            <ParityMatrix workstream={parityWorkstream} />
          </div>
        ) : (
          <div
            className="text-center text-neutral-600"
            style={{ fontFamily: MONO, paddingTop: 120, paddingBottom: 120 }}
          >
            <p className="uppercase tracking-widest" style={{ fontSize: 18 }}>
              parity matrix not configured
            </p>
            <p className="text-neutral-700" style={{ fontSize: 13, marginTop: 10 }}>
              set [parity].epic in config.toml to a configured workstream
            </p>
          </div>
        )}
      </section>
    </DataGate>
  );
}
