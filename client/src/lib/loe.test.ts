import { describe, expect, it } from 'vitest';
import type { Issue, Workstream, WorkstreamPair } from '../../../shared/types.ts';
import { countMissingLOE, hasLOE } from './loe.ts';

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

const pair = (issues: Issue[], key = 'E-1'): WorkstreamPair => {
  const workstream: Workstream = {
    key,
    summary: 'w',
    status: 'In Progress',
    created: '2025-01-01',
    duedate: null,
    issues,
  };
  return {
    workstream,
    bd: {
      series: [],
      totalPoints: 0,
      remaining: 0,
      completedPoints: 0,
      pctComplete: 0,
      issueCount: issues.length,
      doneCount: 0,
    },
  };
};

describe('hasLOE', () => {
  it('returns true when points is a number, including 0', () => {
    expect(hasLOE(issue({ points: 5 }))).toBe(true);
    expect(hasLOE(issue({ points: 0 }))).toBe(true);
  });

  it('returns false when points is null', () => {
    expect(hasLOE(issue({ points: null }))).toBe(false);
  });
});

describe('countMissingLOE', () => {
  it('counts total and unresolved tickets missing LOE across pairs', () => {
    const pairs = [
      pair(
        [
          issue({ key: 'A-1', points: 3 }),
          issue({ key: 'A-2', points: null }),
          issue({ key: 'A-3', points: null, resolutiondate: '2025-02-01' }),
        ],
        'A',
      ),
      pair([issue({ key: 'B-1', points: null }), issue({ key: 'B-2', points: 0 })], 'B'),
    ];
    expect(countMissingLOE(pairs)).toEqual({ total: 3, unresolved: 2 });
  });

  it('returns zero counts for empty input', () => {
    expect(countMissingLOE([])).toEqual({ total: 0, unresolved: 0 });
  });
});
