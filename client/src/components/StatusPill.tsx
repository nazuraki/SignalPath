interface Props {
  status: string;
}

export default function StatusPill({ status }: Props) {
  const s = (status || '').toLowerCase();
  let color = 'bg-neutral-800 text-neutral-400 border-neutral-700';
  if (s.includes('progress') || s.includes('review'))
    color = 'bg-amber-950/40 text-amber-300 border-amber-900/60';
  else if (s.includes('done') || s.includes('closed') || s.includes('resolved'))
    color = 'bg-emerald-950/40 text-emerald-300 border-emerald-900/60';
  else if (s.includes('block')) color = 'bg-rose-950/40 text-rose-300 border-rose-900/60';
  return (
    <span
      className={`shrink-0 px-2 py-0.5 text-[10px] uppercase tracking-widest border ${color}`}
      style={{ fontFamily: '"JetBrains Mono", monospace' }}
    >
      {status}
    </span>
  );
}
