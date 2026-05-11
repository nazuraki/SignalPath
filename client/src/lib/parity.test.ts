import { describe, expect, it } from 'vitest';
import type { Epic, Issue, ParityConfig } from '../../../shared/types.ts';
import { buildParityMatrix } from './parity.ts';

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

const epic = (issues: Issue[]): Epic => ({
  key: 'E-1',
  summary: 'Epic',
  status: 'In Progress',
  created: '2025-01-01',
  duedate: null,
  issues,
});

const parity: ParityConfig = {
  epic: 'E-1',
  svcMap: { 'Service A Core': 'service-a', 'Service B Core': 'service-b' },
  svcLabelMap: { ServiceC: 'service-c' },
  modMap: { 'mod-a': 'Module A', 'mod-b': 'Module B' },
  na: { 'service-b': ['mod-a'] },
};

describe('buildParityMatrix', () => {
  it('preserves insertion order from svcMap then svcLabelMap', () => {
    const { services } = buildParityMatrix(epic([]), parity);
    expect(services).toEqual(['service-a', 'service-b', 'service-c']);
  });

  it('preserves module column order from modMap', () => {
    const { modules } = buildParityMatrix(epic([]), parity);
    expect(modules).toEqual(['mod-a', 'mod-b']);
  });

  it('routes issues by component → service and label → module', () => {
    const e = epic([
      issue({ key: 'X-1', components: ['Service A Core'], labels: ['mod-a'] }),
      issue({ key: 'X-2', components: ['Service B Core'], labels: ['mod-b'] }),
    ]);
    const { cells } = buildParityMatrix(e, parity);
    expect(cells['service-a']?.['mod-a']?.key).toBe('X-1');
    expect(cells['service-b']?.['mod-b']?.key).toBe('X-2');
  });

  it('falls back to svcLabelMap when no mapped component is present', () => {
    const e = epic([issue({ key: 'X-3', components: [], labels: ['ServiceC', 'mod-a'] })]);
    const { cells } = buildParityMatrix(e, parity);
    expect(cells['service-c']?.['mod-a']?.key).toBe('X-3');
  });

  it('skips issues with no module label', () => {
    const e = epic([issue({ key: 'X-4', components: ['Service A Core'], labels: [] })]);
    const { cells } = buildParityMatrix(e, parity);
    expect(cells['service-a']).toBeUndefined();
  });

  it('skips issues with no mapped service signal', () => {
    const e = epic([issue({ key: 'X-5', components: ['Unknown Core'], labels: ['mod-a'] })]);
    const { cells } = buildParityMatrix(e, parity);
    expect(cells['service-a']).toBeUndefined();
  });
});
