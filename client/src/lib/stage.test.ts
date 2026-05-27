import { describe, expect, it } from 'vitest';
import type { Issue, Stage } from '../../../shared/types.ts';
import { stageOf } from './stage.ts';

const issue = (overrides: Partial<Issue> = {}): Issue => ({
  key: 'X-1',
  summary: 's',
  status: '',
  points: null,
  resolutiondate: null,
  labels: [],
  components: [],
  ...overrides,
});

const DEFAULT_MAP: Record<string, Stage> = { 'ready for release': 'pending' };

describe('stageOf', () => {
  it('returns backlog for unknown status with empty map', () => {
    expect(stageOf(issue({ status: 'To Do' }), {})).toBe('backlog');
  });

  it('returns progress on heuristic "In Progress"', () => {
    expect(stageOf(issue({ status: 'In Progress' }), {})).toBe('progress');
  });

  it('returns progress on heuristic "Doing"', () => {
    expect(stageOf(issue({ status: 'Doing' }), {})).toBe('progress');
  });

  it('returns review on heuristic "In Review"', () => {
    expect(stageOf(issue({ status: 'In Review' }), {})).toBe('review');
  });

  it('returns done when resolutiondate is set', () => {
    expect(stageOf(issue({ status: 'Done', resolutiondate: '2026-05-01' }), {})).toBe('done');
  });

  it('maps "Ready for Release" → pending via default map', () => {
    expect(stageOf(issue({ status: 'Ready for Release' }), DEFAULT_MAP)).toBe('pending');
  });

  it('matches stageMap case-insensitively', () => {
    expect(stageOf(issue({ status: 'READY FOR RELEASE' }), DEFAULT_MAP)).toBe('pending');
    expect(stageOf(issue({ status: 'ready for release' }), DEFAULT_MAP)).toBe('pending');
  });

  it('stageMap wins over resolutiondate fallback', () => {
    // resolutiondate would otherwise force 'done'; explicit mapping wins.
    const map: Record<string, Stage> = { 'ready for release': 'released' };
    expect(stageOf(issue({ status: 'Ready for Release', resolutiondate: '2026-05-01' }), map)).toBe(
      'released',
    );
  });

  it('stageMap wins over heuristic match', () => {
    // "In Review" would heuristically be review; explicit mapping overrides.
    const map: Record<string, Stage> = { 'in review': 'pending' };
    expect(stageOf(issue({ status: 'In Review' }), map)).toBe('pending');
  });

  it('user can map a status to releasing or released', () => {
    const map: Record<string, Stage> = {
      releasing: 'releasing',
      released: 'released',
    };
    expect(stageOf(issue({ status: 'Releasing' }), map)).toBe('releasing');
    expect(stageOf(issue({ status: 'Released' }), map)).toBe('released');
  });

  it('falls through to backlog when nothing matches', () => {
    expect(stageOf(issue({ status: 'Triage' }), DEFAULT_MAP)).toBe('backlog');
  });
});
