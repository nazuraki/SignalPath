import type { EpicPair } from '../../../shared/types.ts';
import { EPIC_COLORS } from '../lib/burndown.ts';
import { useConfig, useJiraUrl } from '../lib/config-context.ts';
import { fmt1, fmtDate } from '../lib/format.ts';
import ParityMatrix from './ParityMatrix.tsx';
import StatusPill from './StatusPill.tsx';

interface Props {
  pairs: EpicPair[];
  activeTab: string | null;
  onTabChange: (key: string) => void;
}

export default function TicketPanel({ pairs, activeTab, onTabChange }: Props) {
  const { parity } = useConfig();
  const jiraUrl = useJiraUrl();
  const pair = pairs.find((p) => p.epic.key === activeTab) || pairs[0];
  if (!pair) return null;
  const { epic } = pair;

  const issues = [...(epic.issues || [])].sort((a, b) => {
    const w = (i: typeof a): number => {
      if (i.resolutiondate) return 2;
      const s = i.status.toLowerCase();
      if (s.includes('progress') || s.includes('review')) return 0;
      return 1;
    };
    return w(a) - w(b);
  });

  return (
    <div className="border border-neutral-800">
      <div className="flex border-b border-neutral-800 overflow-x-auto">
        {pairs.map(({ epic: e }, i) => {
          const color = EPIC_COLORS[i % EPIC_COLORS.length];
          const isActive = e.key === activeTab;
          return (
            <button
              type="button"
              key={e.key}
              onClick={() => onTabChange(e.key)}
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
              className={`px-4 py-3 text-xs tracking-wider whitespace-nowrap transition-colors border-r border-neutral-800 flex items-center gap-2 ${
                isActive
                  ? 'bg-neutral-900/60 text-neutral-100'
                  : 'text-neutral-600 hover:text-neutral-400 hover:bg-neutral-900/20'
              }`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0 transition-colors"
                style={{ backgroundColor: isActive ? color : '#3f3f46' }}
              />
              {e.key}
            </button>
          );
        })}
        <div className="flex-1 border-b border-transparent" />
      </div>

      {parity.epic && epic.key === parity.epic && (
        <div className="border-b border-neutral-800">
          <ParityMatrix epic={epic} />
        </div>
      )}

      <div className="divide-y divide-neutral-900/60">
        {issues.length === 0 ? (
          <p
            className="px-6 py-8 text-center text-neutral-700 text-sm"
            style={{ fontFamily: '"JetBrains Mono", monospace', fontStyle: 'italic' }}
          >
            no issues
          </p>
        ) : (
          issues.map((issue) => {
            const done = !!issue.resolutiondate;
            return (
              <div
                key={issue.key}
                className={`px-6 py-2.5 flex items-center gap-4 transition-colors ${done ? 'opacity-35' : 'hover:bg-neutral-900/20'}`}
              >
                <a
                  href={jiraUrl(issue.key)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontFamily: '"JetBrains Mono", monospace' }}
                  className="text-xs text-amber-400/60 hover:text-amber-400 shrink-0 w-[5.5rem] transition-colors"
                >
                  {issue.key}
                </a>
                <StatusPill status={issue.status} />
                <span
                  style={{ fontFamily: '"Newsreader", serif' }}
                  className={`flex-1 text-sm truncate min-w-0 ${
                    done ? 'line-through text-neutral-600' : 'text-neutral-300'
                  }`}
                >
                  {issue.summary}
                </span>
                <span
                  style={{ fontFamily: '"JetBrains Mono", monospace' }}
                  className="text-xs text-neutral-600 shrink-0 w-10 text-right tabular-nums"
                >
                  {issue.points !== null ? `${fmt1(issue.points)}h` : '—'}
                </span>
                <span
                  style={{ fontFamily: '"JetBrains Mono", monospace' }}
                  className="text-xs text-neutral-700 shrink-0 w-16 text-right"
                >
                  {issue.resolutiondate ? fmtDate(issue.resolutiondate) : '—'}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div
        className="px-6 py-3 border-t border-neutral-900 flex items-center justify-between"
        style={{ fontFamily: '"JetBrains Mono", monospace' }}
      >
        <span className="text-[11px] text-neutral-600">
          {`${pair.bd.doneCount} of ${pair.bd.issueCount} resolved`}
        </span>
        <span className="text-[11px] text-neutral-600">
          {`${fmt1(pair.bd.completedPoints)} / ${fmt1(pair.bd.totalPoints)}h complete`}
        </span>
      </div>
    </div>
  );
}
