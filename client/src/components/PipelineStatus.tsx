import type { Issue, WorkstreamPair } from '../../../shared/types.ts';
import { useTicketUrl } from '../lib/config-context.ts';

type Stage = 'backlog' | 'progress' | 'review' | 'done';

const MONO = '"JetBrains Mono", monospace';
const INTER = 'Inter, system-ui, sans-serif';

function stageOf(issue: Issue): Stage {
  if (issue.resolutiondate) return 'done';
  const s = issue.status.toLowerCase();
  if (s.includes('review')) return 'review';
  if (s.includes('progress') || s.includes('doing')) return 'progress';
  return 'backlog';
}

interface ChipProps {
  issue: Issue;
  href: string;
}

function ActiveChip({ issue, href }: ChipProps) {
  const inReview = stageOf(issue) === 'review';
  const accent = inReview ? 'var(--c-review)' : 'var(--c-accent)';
  const borderAccent = inReview
    ? 'color-mix(in srgb, var(--c-review) 33%, transparent)'
    : 'color-mix(in srgb, var(--c-accent) 33%, transparent)';
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="task-chip flex flex-col justify-center z-10 border transition-colors"
      style={{
        borderColor: borderAccent,
        borderLeftWidth: 3,
        borderLeftColor: accent,
        fontFamily: MONO,
        minWidth: 225,
        maxWidth: 300,
        padding: '10px 16px',
        gap: 2,
      }}
    >
      <div className="flex items-center justify-between" style={{ gap: 16 }}>
        <span className="font-bold" style={{ color: accent, fontSize: 14 }}>
          {issue.key}
        </span>
        <span className="uppercase tracking-wider opacity-50" style={{ fontSize: 13 }}>
          {inReview ? 'review' : 'in prog'}
        </span>
      </div>
      <span
        className="text-neutral-200 overflow-hidden whitespace-nowrap text-ellipsis"
        style={{ fontFamily: INTER, fontSize: 15 }}
      >
        {issue.summary}
      </span>
    </a>
  );
}

function DoneChip({ issue, href }: ChipProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="flex items-center z-10 border opacity-70 hover:opacity-100 transition-opacity"
      style={{
        borderColor: 'var(--c-done-border)',
        backgroundColor: 'var(--c-done-bg)',
        fontFamily: MONO,
        height: 36,
        padding: '0 12px',
        gap: 8,
      }}
    >
      <span style={{ width: 8, height: 8, backgroundColor: 'var(--c-done)' }} />
      <span style={{ color: 'var(--c-done-text)', fontSize: 14 }}>{issue.key}</span>
    </a>
  );
}

interface RowProps {
  pair: WorkstreamPair;
  isActive: boolean;
  isAnyActive: boolean;
  color: string;
  onClick: () => void;
}

function Row({ pair, isActive, isAnyActive, color, onClick }: RowProps) {
  const ticketUrl = useTicketUrl();
  const { workstream, bd } = pair;
  const dimmed = isAnyActive && !isActive;

  const buckets: Record<Stage, Issue[]> = { backlog: [], progress: [], review: [], done: [] };
  for (const i of workstream.issues) buckets[stageOf(i)].push(i);

  const recentDone = buckets.done
    .slice()
    .sort((a, b) => (b.resolutiondate || '').localeCompare(a.resolutiondate || ''))
    .slice(0, 2);

  const backlogDots = Math.min(buckets.backlog.length, 6);
  const backlogOverflow = buckets.backlog.length - backlogDots;
  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      className="pipeline-row flex items-stretch border cursor-pointer select-none transition-all"
      style={{ borderColor: 'var(--c-border)', minHeight: 110, opacity: dimmed ? 0.35 : 1 }}
    >
      {/* Left: epic name + progress */}
      <div
        className="flex flex-col justify-center shrink-0"
        style={{ borderRight: '1px solid var(--c-border)', width: 400, padding: '20px 24px' }}
      >
        <div className="flex items-baseline justify-between" style={{ gap: 10, marginBottom: 10 }}>
          <div className="flex items-baseline min-w-0" style={{ gap: 8 }}>
            <span
              className="font-bold truncate"
              style={{
                color: isActive ? color : 'var(--c-accent)',
                fontFamily: MONO,
                fontSize: 16,
              }}
            >
              {workstream.summary || workstream.key}
            </span>
            <a
              href={ticketUrl(workstream.key)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title={`Open ${workstream.key}`}
              aria-label={`Open ${workstream.key}`}
              className="shrink-0 transition-colors"
              style={{ transform: 'translateY(2px)', color: 'var(--c-text-subtle)' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.color = 'var(--c-text)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.color = 'var(--c-text-subtle)';
              }}
            >
              <svg
                width="12"
                height="12"
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
            </a>
          </div>
          <span
            className="tabular-nums opacity-60 shrink-0"
            style={{ fontFamily: MONO, fontSize: 14 }}
          >
            {`${bd.pctComplete}%`}
          </span>
        </div>
        <div className="progress-track w-full" style={{ height: 4 }}>
          <div
            className="h-full transition-all"
            style={{
              width: `${bd.pctComplete}%`,
              backgroundColor: isActive ? color : 'var(--c-accent)',
            }}
          />
        </div>
        <div
          className="text-neutral-500 tabular-nums"
          style={{ fontFamily: MONO, fontSize: 13, marginTop: 10 }}
        >
          <span className="text-neutral-300">{bd.doneCount}</span>
          {`/${bd.issueCount} issues · `}
          <span className="text-neutral-300">{Math.round(bd.completedPoints)}</span>
          {`/${Math.round(bd.totalPoints)}h`}
        </div>
      </div>

      {/* Right: track */}
      <div className="flex-1 relative overflow-x-auto" style={{ padding: '20px 40px' }}>
        <div
          className="absolute left-0 right-0 top-1/2"
          style={{ height: 1, backgroundColor: 'var(--c-border)' }}
        />
        <div className="relative flex items-center h-full" style={{ gap: 20, minHeight: 70 }}>
          {/* Backlog dots */}
          {backlogDots > 0 && (
            <div className="flex items-center z-10" style={{ gap: 8 }}>
              {buckets.backlog.slice(0, backlogDots).map((issue) => (
                <a
                  key={issue.key}
                  href={ticketUrl(issue.key, workstream.key)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title={`${issue.key} — ${issue.summary}`}
                  className="transition-opacity hover:opacity-60"
                  style={{ width: 8, height: 8, backgroundColor: 'var(--c-backlog)' }}
                />
              ))}
              {backlogOverflow > 0 && (
                <span
                  className="text-neutral-600"
                  style={{ fontFamily: MONO, fontSize: 13, marginLeft: 6 }}
                >
                  {`+${backlogOverflow}`}
                </span>
              )}
            </div>
          )}

          {/* In progress chips */}
          {buckets.progress.map((issue) => (
            <ActiveChip key={issue.key} issue={issue} href={ticketUrl(issue.key, workstream.key)} />
          ))}

          {/* Review chips */}
          {buckets.review.map((issue) => (
            <ActiveChip key={issue.key} issue={issue} href={ticketUrl(issue.key, workstream.key)} />
          ))}

          {/* Recent done */}
          {recentDone.map((issue) => (
            <DoneChip key={issue.key} issue={issue} href={ticketUrl(issue.key, workstream.key)} />
          ))}
          {buckets.done.length > recentDone.length && (
            <span
              className="text-neutral-600 z-10"
              style={{
                fontFamily: MONO,
                fontSize: 13,
                padding: '0 6px',
                backgroundColor: 'var(--c-bg)',
              }}
            >
              {`+${buckets.done.length - recentDone.length} done`}
            </span>
          )}

          {workstream.issues.length === 0 && (
            <span
              className="text-neutral-700 italic z-10"
              style={{ fontFamily: MONO, fontSize: 14 }}
            >
              no issues
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface Props {
  pairs: WorkstreamPair[];
  activeWorkstream: string | null;
  colors: string[];
  onRowClick: (key: string) => void;
}

export default function PipelineStatus({ pairs, activeWorkstream, colors, onRowClick }: Props) {
  return (
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
            Pipeline Status
          </span>
        </div>
        <div className="flex items-center" style={{ fontFamily: MONO, gap: 24 }}>
          <Legend swatch="var(--c-backlog)" label="Backlog" />
          <Legend swatch="var(--c-accent)" label="In Progress" />
          <Legend swatch="var(--c-review)" label="Review" />
          <Legend swatch="var(--c-done)" label="Done" />
        </div>
      </div>
      <div className="flex flex-col" style={{ gap: 10 }}>
        {pairs.map((pair, i) => (
          <Row
            key={pair.workstream.key}
            pair={pair}
            isActive={activeWorkstream === pair.workstream.key}
            isAnyActive={activeWorkstream !== null}
            color={colors[i % colors.length]}
            onClick={() => onRowClick(pair.workstream.key)}
          />
        ))}
      </div>
    </section>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span
      className="flex items-center uppercase tracking-wider text-neutral-500"
      style={{ fontSize: 13, gap: 8 }}
    >
      <span style={{ width: 8, height: 8, backgroundColor: swatch }} />
      {label}
    </span>
  );
}
