import type { MetricValue, PipelineItem, RolloutProgress } from '../../../shared/types.ts';
import DataGate from '../components/DataGate.tsx';
import WarningBanner from '../components/WarningBanner.tsx';
import { useTicketUrl } from '../lib/config-context.ts';
import { fmtMetric } from '../lib/format.ts';
import { usePipeline } from '../lib/pipeline-context.ts';
import { STAGE_ACCENT, STAGE_LABEL } from '../lib/stage-style.ts';

const MONO = '"JetBrains Mono", monospace';
const INTER = 'Inter, system-ui, sans-serif';

/** Human labels for how the rollout percentage was derived, for the bar's tooltip. */
const PERCENT_SOURCE_LABEL: Record<string, string> = {
  stable: 'fully promoted to stable',
  'canary-weight': 'from the canary traffic weight',
  'step-weight': 'from the current canary step’s setWeight',
  replicas: 'from updated ÷ total replicas',
};

function ExternalIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 3h6v6" />
      <path d="M10 14L21 3" />
      <path d="M21 14v7H3V3h7" />
    </svg>
  );
}

function LinkChip({ href, label, title }: { href: string; label: string; title?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title ?? label}
      className="icon-btn flex items-center border text-neutral-500 uppercase tracking-wider"
      style={{
        borderColor: 'var(--c-border)',
        fontFamily: MONO,
        fontSize: 12,
        padding: '4px 10px',
        gap: 6,
      }}
    >
      <ExternalIcon />
      {label}
    </a>
  );
}

function MetricTile({ metric }: { metric: MetricValue }) {
  const missing = metric.value === null;
  return (
    <div
      className="border flex flex-col"
      style={{
        borderColor: 'var(--c-border)',
        fontFamily: MONO,
        padding: '6px 12px',
        gap: 2,
        minWidth: 84,
        opacity: missing ? 0.45 : 1,
      }}
      title={missing ? (metric.error ?? 'no value') : undefined}
    >
      <span
        className="uppercase tracking-wider text-neutral-500"
        style={{ fontSize: 11, lineHeight: 1.2 }}
      >
        {metric.label}
      </span>
      <span className="tabular-nums" style={{ fontSize: 15, lineHeight: 1.2 }}>
        {missing ? '—' : fmtMetric(metric.value as number)}
        {!missing && metric.unit && (
          <span className="text-neutral-500" style={{ fontSize: 11, marginLeft: 3 }}>
            {metric.unit}
          </span>
        )}
      </span>
    </div>
  );
}

/**
 * The rollout row. A null percent renders "—" rather than an empty bar, so a
 * rollout we simply can't measure never looks like one that hasn't started.
 */
function RolloutRow({ rollout, accent }: { rollout: RolloutProgress; accent: string }) {
  const { percent, source } = rollout;
  const detail: string[] = [];
  if (rollout.argoPhase) detail.push(rollout.argoPhase);
  if (typeof rollout.currentStepIndex === 'number' && rollout.totalSteps) {
    detail.push(`step ${rollout.currentStepIndex}/${rollout.totalSteps}`);
  }
  if (typeof rollout.updatedReplicas === 'number' && typeof rollout.replicas === 'number') {
    detail.push(`${rollout.updatedReplicas}/${rollout.replicas} pods`);
  }

  return (
    <div className="flex items-center" style={{ gap: 14, fontFamily: MONO }}>
      <span
        className="uppercase tracking-wider text-neutral-500 shrink-0"
        style={{ fontSize: 11, width: 52 }}
      >
        rollout
      </span>
      {rollout.error ? (
        <span className="text-neutral-600" style={{ fontSize: 13 }}>
          {rollout.error}
        </span>
      ) : (
        <>
          <div
            className="progress-track shrink-0"
            style={{ height: 4, width: 200 }}
            title={
              source ? `${percent}% — ${PERCENT_SOURCE_LABEL[source]}` : 'percentage unavailable'
            }
          >
            <div
              className="h-full transition-all"
              style={{ width: `${percent ?? 0}%`, backgroundColor: accent }}
            />
          </div>
          <span className="tabular-nums shrink-0" style={{ fontSize: 14, width: 44 }}>
            {percent === null ? '—' : `${percent}%`}
          </span>
          {detail.length > 0 && (
            <span className="text-neutral-500 truncate" style={{ fontSize: 13 }}>
              {detail.join(' · ')}
            </span>
          )}
          {rollout.paused && (
            <span
              className="uppercase tracking-wider border shrink-0"
              style={{
                borderColor: 'var(--c-warn-border, #b45309)',
                color: 'var(--c-warn, #f59e0b)',
                fontSize: 11,
                padding: '1px 6px',
              }}
              title={rollout.message ?? 'Rollout is paused awaiting promotion'}
            >
              paused
            </span>
          )}
        </>
      )}
    </div>
  );
}

function Card({ item }: { item: PipelineItem }) {
  const ticketUrl = useTicketUrl();
  const accent = STAGE_ACCENT[item.stage];
  const { release, rollout, metrics } = item;
  const showLinks = Boolean(release?.runUrl || item.slackRelease || item.grafanaUrl);

  return (
    <div
      className="border flex flex-col"
      style={{
        borderColor: 'var(--c-border)',
        borderLeftWidth: 3,
        borderLeftColor: accent,
        backgroundColor: 'var(--c-bg-card-60)',
        padding: '14px 18px',
        gap: 12,
      }}
    >
      {/* Header: ticket, summary, stage, service */}
      <div className="flex items-baseline" style={{ gap: 12 }}>
        <a
          href={ticketUrl(item.issue.key, item.workstreamKey)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold shrink-0 hover:underline"
          style={{ color: accent, fontFamily: MONO, fontSize: 14 }}
        >
          {item.issue.key}
        </a>
        <span
          className="text-neutral-200 flex-1 min-w-0 truncate"
          style={{ fontFamily: INTER, fontSize: 15 }}
          title={item.issue.summary}
        >
          {item.issue.summary}
        </span>
        {item.svcKey ? (
          <span
            className="text-neutral-500 shrink-0"
            style={{ fontFamily: MONO, fontSize: 13 }}
            title="Deploy service resolved from the issue’s component/label"
          >
            {item.svcKey}
          </span>
        ) : (
          <span
            className="text-neutral-700 shrink-0"
            style={{ fontFamily: MONO, fontSize: 13 }}
            title="No parity.svc_map component or label matched — no deploy signals available"
          >
            no service
          </span>
        )}
        <span
          className="uppercase tracking-wider shrink-0"
          style={{ color: accent, fontFamily: MONO, fontSize: 12 }}
        >
          {STAGE_LABEL[item.stage]}
        </span>
      </div>

      {/* Epic + jira status */}
      <div
        className="flex items-center text-neutral-600"
        style={{ fontFamily: MONO, fontSize: 12, gap: 10, marginTop: -6 }}
      >
        <a
          href={ticketUrl(item.workstreamKey)}
          target="_blank"
          rel="noopener noreferrer"
          className="icon-btn hover:underline"
        >
          {item.workstreamSummary || item.workstreamKey}
        </a>
        <span>·</span>
        <span>{item.issue.status}</span>
        {release?.phase && (
          <>
            <span>·</span>
            <span title={release.detail ?? undefined}>{`ci ${release.phase}`}</span>
          </>
        )}
      </div>

      {rollout && <RolloutRow rollout={rollout} accent={accent} />}

      {showLinks && (
        <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
          {release?.runUrl && (
            <LinkChip href={release.runUrl} label="gha run" title="GitHub Actions release run" />
          )}
          {item.slackRelease && (
            <LinkChip
              href={item.slackRelease.url}
              label="slack release"
              title={item.slackRelease.text}
            />
          )}
          {item.grafanaUrl && (
            <LinkChip href={item.grafanaUrl} label="grafana" title="Grafana dashboard" />
          )}
        </div>
      )}

      {metrics && metrics.length > 0 && (
        <div className="flex items-stretch flex-wrap" style={{ gap: 8 }}>
          {metrics.map((m) => (
            <MetricTile key={m.key} metric={m} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PipelinePage() {
  const { pipeline, loading, error, lastUpdated, refresh } = usePipeline();
  const items = pipeline?.items ?? [];

  return (
    <section>
      <div
        className="flex items-center justify-between flex-wrap gap-3"
        style={{ paddingLeft: 6, marginBottom: 16 }}
      >
        <div className="flex items-center gap-4">
          <span style={{ width: 8, height: 8, backgroundColor: 'var(--c-accent)' }} />
          <span
            className="uppercase tracking-[0.25em] text-neutral-500"
            style={{ fontFamily: MONO, fontSize: 14 }}
          >
            Release Control
          </span>
          {items.length > 0 && (
            <span className="text-neutral-600" style={{ fontFamily: MONO, fontSize: 13 }}>
              {`${items.length} in flight`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2" style={{ fontFamily: MONO }}>
          {lastUpdated && (
            <span className="text-neutral-700" style={{ fontSize: 12 }}>
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="icon-btn uppercase tracking-[0.2em] text-neutral-500 disabled:opacity-30 border"
            style={{ borderColor: 'var(--c-border)', fontSize: 13, padding: '6px 14px' }}
          >
            {loading ? 'fetching…' : '↻ refresh'}
          </button>
        </div>
      </div>

      {pipeline?.warnings.map((w) => (
        <WarningBanner key={w}>{w}</WarningBanner>
      ))}

      <DataGate loading={loading} error={error} empty={pipeline === null}>
        {items.length === 0 ? (
          <div
            className="text-center text-neutral-600"
            style={{ fontFamily: MONO, paddingTop: 120, paddingBottom: 120 }}
          >
            <p className="uppercase tracking-widest" style={{ fontSize: 16 }}>
              nothing in flight
            </p>
            <p className="text-neutral-700" style={{ fontSize: 13, marginTop: 10 }}>
              no tickets are pending, releasing, or released
            </p>
          </div>
        ) : (
          <div className="flex flex-col" style={{ gap: 10 }}>
            {items.map((item) => (
              <Card key={`${item.workstreamKey}/${item.issue.key}`} item={item} />
            ))}
          </div>
        )}
      </DataGate>
    </section>
  );
}
