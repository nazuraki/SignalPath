import { describe, expect, it } from 'vitest';
import type { Epic, EpicPair, Issue } from '../../../shared/types.ts';
import { buildCombinedSeries, computeBurndown, pointsOf, remainingHours } from './burndown.ts';

const issue = (overrides: Partial<Issue> = {}): Issue => ({
  key: 'X-1',
  summary: 's',
  status: 'To Do',
  points: 1,
  resolutiondate: null,
  labels: [],
  components: [],
  ...overrides,
});

const epic = (issues: Issue[], overrides: Partial<Epic> = {}): Epic => ({
  key: 'E-1',
  summary: 'Epic',
  status: 'In Progress',
  created: '2025-01-01',
  duedate: null,
  issues,
  ...overrides,
});

describe('pointsOf', () => {
  it('uses the points field when numeric', () => {
    expect(pointsOf(issue({ points: 4 }))).toBe(4);
    expect(pointsOf(issue({ points: 0 }))).toBe(0);
  });

  it('falls back to 1 when points is null', () => {
    expect(pointsOf(issue({ points: null }))).toBe(1);
  });
});

describe('remainingHours', () => {
  it('sums points of unresolved issues only', () => {
    const e = epic([
      issue({ points: 3, resolutiondate: null }),
      issue({ points: 5, resolutiondate: '2025-02-01' }),
      issue({ points: null, resolutiondate: null }),
    ]);
    expect(remainingHours(e)).toBe(4);
  });

  it('returns 0 for an empty epic', () => {
    expect(remainingHours(epic([]))).toBe(0);
  });
});

describe('computeBurndown', () => {
  it('reports totals, counts, and percent complete', () => {
    const e = epic(
      [
        issue({ key: 'X-1', points: 4, resolutiondate: '2025-01-05' }),
        issue({ key: 'X-2', points: 6, resolutiondate: null }),
        issue({ key: 'X-3', points: 2, resolutiondate: '2025-01-10' }),
      ],
      { projectedEnd: '2025-02-01' },
    );
    const bd = computeBurndown(e);
    expect(bd.totalPoints).toBe(12);
    expect(bd.completedPoints).toBe(6);
    expect(bd.remaining).toBe(6);
    expect(bd.issueCount).toBe(3);
    expect(bd.doneCount).toBe(2);
    expect(bd.pctComplete).toBe(50);
  });

  it('returns 0% for an empty epic without dividing by zero', () => {
    const bd = computeBurndown(epic([], { projectedEnd: '2025-02-01' }));
    expect(bd.totalPoints).toBe(0);
    expect(bd.pctComplete).toBe(0);
    expect(bd.remaining).toBe(0);
  });

  it('emits a series that includes ideal and (for past dates) actual values', () => {
    const bd = computeBurndown(
      epic(
        [
          issue({ key: 'X-1', points: 2, resolutiondate: '2025-01-03' }),
          issue({ key: 'X-2', points: 2, resolutiondate: null }),
        ],
        { created: '2025-01-01', projectedEnd: '2025-01-10' },
      ),
    );
    expect(bd.series.length).toBeGreaterThan(0);
    expect(bd.series[0].ideal).toBeGreaterThanOrEqual(bd.series.at(-1)?.ideal ?? 0);
  });
});

describe('buildCombinedSeries', () => {
  it('keys actual values by epic key and sorts by date', () => {
    const pairs: EpicPair[] = [
      {
        epic: epic([], { key: 'A' }),
        bd: {
          series: [
            { date: '2025-01-02', label: 'Jan 2', actual: 5, ideal: 10 },
            { date: '2025-01-01', label: 'Jan 1', actual: 10, ideal: 10 },
          ],
          totalPoints: 10,
          remaining: 5,
          completedPoints: 5,
          pctComplete: 50,
          issueCount: 0,
          doneCount: 0,
        },
      },
      {
        epic: epic([], { key: 'B' }),
        bd: {
          series: [
            { date: '2025-01-01', label: 'Jan 1', actual: 3, ideal: 3 },
            { date: '2025-01-02', label: 'Jan 2', actual: null, ideal: 0 },
          ],
          totalPoints: 3,
          remaining: 0,
          completedPoints: 3,
          pctComplete: 100,
          issueCount: 0,
          doneCount: 0,
        },
      },
    ];
    const series = buildCombinedSeries(pairs);
    expect(series.map((r) => r.date)).toEqual(['2025-01-01', '2025-01-02']);
    expect(series[0]).toMatchObject({ date: '2025-01-01', A: 10, B: 3 });
    expect(series[1]).toMatchObject({ date: '2025-01-02', A: 5 });
    // null actuals don't land in the combined row
    expect(series[1].B).toBeUndefined();
  });
});
