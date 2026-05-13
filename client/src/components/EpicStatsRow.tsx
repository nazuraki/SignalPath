import type { BurndownResult, Workstream } from '../../../shared/types.ts';
import { useJiraUrl } from '../lib/config-context.ts';
import { fmt1, fmtDate } from '../lib/format.ts';
import StatusPill from './StatusPill.tsx';

interface Props {
  workstream: Workstream;
  bd: BurndownResult;
  color: string;
  isActive: boolean;
  isAnyActive: boolean;
  onClick: () => void;
}

export default function EpicStatsRow({
  workstream,
  bd,
  color,
  isActive,
  isAnyActive,
  onClick,
}: Props) {
  const jiraUrl = useJiraUrl();
  const dimmed = isAnyActive && !isActive;
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
      className="relative px-6 py-4 border-b border-neutral-900 cursor-pointer select-none transition-all"
      style={{
        opacity: dimmed ? 0.28 : 1,
        backgroundColor: isActive ? 'rgba(255,255,255,0.03)' : 'transparent',
      }}
    >
      <div
        className="absolute left-0 inset-y-0 w-0.5 transition-colors"
        style={{ backgroundColor: isActive ? color : 'transparent' }}
      />

      <div className="flex items-center gap-3 min-w-0">
        <span
          className="w-2 h-2 rounded-full shrink-0 transition-colors"
          style={{ backgroundColor: isActive ? color : '#3f3f46' }}
        />
        <a
          href={jiraUrl(workstream.key)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
          className="text-xs text-neutral-400 hover:text-amber-400 shrink-0 w-[5.5rem] transition-colors"
        >
          {workstream.key}
        </a>
        <StatusPill status={workstream.status} />
        <span
          style={{ fontFamily: '"Newsreader", serif' }}
          className="flex-1 text-sm text-neutral-200 truncate min-w-0 overflow-hidden whitespace-nowrap"
        >
          {workstream.summary}
        </span>
        <div
          className="flex items-center gap-5 shrink-0 text-xs"
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
        >
          <span className="text-neutral-600 hidden sm:inline">
            <span className="text-neutral-300">{bd.doneCount}</span>
            {`/${bd.issueCount} issues`}
          </span>
          <span className="text-neutral-600 whitespace-nowrap">
            <span className="text-neutral-300">{Math.round(bd.completedPoints)}</span>
            {`/${Math.round(bd.totalPoints)}h`}
          </span>
          <span
            className="w-8 text-right tabular-nums"
            style={{ color: isActive ? color : '#a3a3a3' }}
          >
            {`${bd.pctComplete}%`}
          </span>
          <span className="text-neutral-400 w-20 text-right tabular-nums whitespace-nowrap">
            {`${fmt1(bd.remaining)}h left`}
          </span>
          <span className="text-neutral-600 w-20 text-right hidden md:inline">
            {workstream.projectedEnd ? `proj ${fmtDate(workstream.projectedEnd)}` : ''}
          </span>
        </div>
      </div>

      <div className="mt-2.5 ml-5 h-px bg-neutral-800">
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${bd.pctComplete}%`,
            backgroundColor: color,
            opacity: isActive ? 0.7 : 0.35,
          }}
        />
      </div>
    </div>
  );
}
