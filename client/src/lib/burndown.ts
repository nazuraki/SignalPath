import type {
  BurndownPoint,
  BurndownResult,
  Epic,
  EpicPair,
  Issue,
} from '../../../shared/types.ts';

export const HOURS_PER_WEEK = 30;

export const EPIC_COLORS = ['#fbbf24', '#22d3ee', '#a78bfa', '#34d399', '#fb7185'];

export const pointsOf = (i: Issue): number => (typeof i.points === 'number' ? i.points : 1);

export const remainingHours = (epic: Epic): number =>
  (epic.issues || []).filter((i) => !i.resolutiondate).reduce((s, i) => s + pointsOf(i), 0);

export const computeBurndown = (epic: Epic): BurndownResult => {
  const issues = epic.issues || [];
  const totalPoints = issues.reduce((s, i) => s + pointsOf(i), 0);

  const created = new Date(`${epic.created}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const projEnd = epic.projectedEnd ? new Date(`${epic.projectedEnd}T00:00:00`) : null;
  const endDate = projEnd && projEnd > today ? projEnd : today;

  const resolved = issues
    .filter((i): i is Issue & { resolutiondate: string } => !!i.resolutiondate)
    .map((i) => ({ date: new Date(`${i.resolutiondate}T00:00:00`), points: pointsOf(i) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const idealEndDate = projEnd || today;
  const totalIdealDays = Math.max(
    1,
    Math.round((idealEndDate.getTime() - created.getTime()) / 86400000),
  );
  const days = Math.max(1, Math.round((endDate.getTime() - created.getTime()) / 86400000));
  const step = Math.max(1, Math.ceil(days / 120));
  const todayStr = today.toISOString().slice(0, 10);

  const series: BurndownPoint[] = [];
  let remaining = totalPoints;
  let ri = 0;
  for (let d = 0; d <= days; d += step) {
    const dt = new Date(created.getTime() + d * 86400000);
    while (ri < resolved.length && resolved[ri].date <= dt) {
      remaining -= resolved[ri].points;
      ri++;
    }
    const ideal = Math.max(0, totalPoints * (1 - d / totalIdealDays));
    const isPast = dt <= today;
    series.push({
      date: dt.toISOString().slice(0, 10),
      label: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      actual: isPast ? Math.max(0, remaining) : null,
      ideal,
    });
  }

  if (!series.some((pt) => pt.date === todayStr)) {
    const resolvedByToday = issues
      .filter((i): i is Issue & { resolutiondate: string } => !!i.resolutiondate)
      .reduce((s, i) => {
        const d = new Date(`${i.resolutiondate}T00:00:00`);
        return d <= today ? s + pointsOf(i) : s;
      }, 0);
    const todayDays = Math.round((today.getTime() - created.getTime()) / 86400000);
    const todayPt: BurndownPoint = {
      date: todayStr,
      label: today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      actual: Math.max(0, totalPoints - resolvedByToday),
      ideal: Math.max(0, totalPoints * (1 - todayDays / totalIdealDays)),
    };
    const insertIdx = series.findIndex((pt) => pt.date > todayStr);
    if (insertIdx === -1) series.push(todayPt);
    else series.splice(insertIdx, 0, todayPt);
  }

  const completedPoints = totalPoints - Math.max(0, remaining);
  const pctComplete = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;

  return {
    series,
    totalPoints,
    remaining: Math.max(0, remaining),
    completedPoints,
    pctComplete,
    issueCount: issues.length,
    doneCount: issues.filter((i) => i.resolutiondate).length,
  };
};

interface CombinedRow {
  date: string;
  label: string;
  [epicKey: string]: string | number | null;
}

export const buildCombinedSeries = (pairs: EpicPair[]): CombinedRow[] => {
  const map = new Map<string, CombinedRow>();
  for (const { epic, bd } of pairs) {
    for (const pt of bd.series) {
      if (!map.has(pt.date)) map.set(pt.date, { date: pt.date, label: pt.label });
      const row = map.get(pt.date);
      if (row && pt.actual !== null) row[epic.key] = pt.actual;
    }
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
};
