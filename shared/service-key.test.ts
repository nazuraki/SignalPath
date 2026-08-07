import { describe, expect, it } from 'vitest';
import { resolveServiceKey } from './service-key.ts';
import type { Issue, ParityConfig } from './types.ts';

const issue = (overrides: Partial<Issue> = {}): Issue => ({
  key: 'X-1',
  summary: 's',
  status: 'To Do',
  points: null,
  resolutiondate: null,
  labels: [],
  components: [],
  ...overrides,
});

const parity: ParityConfig = {
  epic: null,
  svcMap: { 'Service A Core': 'service-a', 'Service B Core': 'service-b' },
  svcLabelMap: { ServiceC_label: 'service-c', ServiceA_label: 'service-a' },
  modMap: {},
  na: {},
};

describe('resolveServiceKey', () => {
  it('resolves from a mapped component', () => {
    expect(resolveServiceKey(issue({ components: ['Service A Core'] }), parity)).toBe('service-a');
  });

  it('ignores unmapped components and falls through to labels', () => {
    expect(
      resolveServiceKey(issue({ components: ['Unrelated'], labels: ['ServiceC_label'] }), parity),
    ).toBe('service-c');
  });

  it('prefers a component over a label when both match', () => {
    expect(
      resolveServiceKey(
        issue({ components: ['Service B Core'], labels: ['ServiceC_label'] }),
        parity,
      ),
    ).toBe('service-b');
  });

  it('returns null when nothing matches', () => {
    expect(resolveServiceKey(issue({ components: ['Nope'], labels: ['nope'] }), parity)).toBeNull();
  });

  it('returns null for an issue with no components or labels', () => {
    expect(resolveServiceKey(issue(), parity)).toBeNull();
  });

  it('matches exactly — keys are literal Jira component/label names', () => {
    expect(resolveServiceKey(issue({ components: ['service a core'] }), parity)).toBeNull();
  });
});
