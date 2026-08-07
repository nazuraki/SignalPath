import { describe, expect, it } from 'vitest';
import { derivePercent, toRolloutProgress } from './kubectl.ts';

/**
 * A fully-promoted rollout as it actually appears in a live cluster: the canary
 * weight is back to 0 and stable holds 100. Reading the canary weight naively
 * here would report 0% for a healthy service, so this shape is the regression
 * guard for the whole rule ordering.
 */
const promotedRollout = {
  spec: {
    strategy: {
      canary: {
        steps: [
          { setWeight: 5 },
          {},
          { setWeight: 10 },
          {},
          { setWeight: 25 },
          {},
          { setWeight: 50 },
          {},
        ],
      },
    },
  },
  status: {
    phase: 'Healthy',
    currentStepIndex: 8,
    replicas: 5,
    updatedReplicas: 5,
    availableReplicas: 5,
    canary: {
      weights: {
        canary: { weight: 0 },
        stable: { weight: 100 },
      },
    },
  },
};

describe('derivePercent', () => {
  it('reports 100% for a fully promoted rollout, not the canary weight of 0', () => {
    const { percent, source } = derivePercent(promotedRollout);
    expect(percent).toBe(100);
    expect(source).toBe('stable');
  });

  it('reports 100% from a stable weight of 100 even without a Healthy phase', () => {
    const { percent, source } = derivePercent({
      status: {
        phase: 'Degraded',
        replicas: 3,
        updatedReplicas: 3,
        canary: { weights: { canary: { weight: 0 }, stable: { weight: 100 } } },
      },
    });
    expect(percent).toBe(100);
    expect(source).toBe('stable');
  });

  it('does not claim 100% while replicas are still rolling', () => {
    const { percent, source } = derivePercent({
      status: {
        phase: 'Healthy',
        replicas: 5,
        updatedReplicas: 2,
        canary: { weights: { canary: { weight: 40 }, stable: { weight: 60 } } },
      },
    });
    expect(percent).toBe(40);
    expect(source).toBe('canary-weight');
  });

  it('prefers a live canary weight over the step and replica rules', () => {
    const { percent, source } = derivePercent({
      spec: { strategy: { canary: { steps: [{ setWeight: 80 }] } } },
      status: {
        phase: 'Paused',
        canary: { weights: { canary: { weight: 30 } } },
        currentStepIndex: 0,
        replicas: 5,
        updatedReplicas: 1,
      },
    });
    expect(percent).toBe(30);
    expect(source).toBe('canary-weight');
  });

  it('falls back to the nearest setWeight at or before the current step', () => {
    const { percent, source } = derivePercent({
      // step 1 is a pause, so the active weight is step 0's.
      spec: { strategy: { canary: { steps: [{ setWeight: 20 }, {}, { setWeight: 60 }] } } },
      status: { currentStepIndex: 1, replicas: 5, updatedReplicas: 3 },
    });
    expect(percent).toBe(20);
    expect(source).toBe('step-weight');
  });

  it('treats a step index past the last step as every step having run', () => {
    const { percent, source } = derivePercent({
      spec: { strategy: { canary: { steps: [{ setWeight: 25 }, {}] } } },
      status: { currentStepIndex: 2 },
    });
    expect(percent).toBe(100);
    expect(source).toBe('step-weight');
  });

  it('ignores a canary weight of 0 and moves on to the step rule', () => {
    // A rollout that has just been triggered: no traffic shifted yet.
    const { percent, source } = derivePercent({
      spec: { strategy: { canary: { steps: [{ setWeight: 5 }, {}] } } },
      status: {
        phase: 'Progressing',
        currentStepIndex: 0,
        replicas: 5,
        updatedReplicas: 0,
        canary: { weights: { canary: { weight: 0 }, stable: { weight: 100 } } },
      },
    });
    expect(percent).toBe(5);
    expect(source).toBe('step-weight');
  });

  it('falls back to the replica ratio — the only rule a plain Deployment hits', () => {
    const { percent, source } = derivePercent({ status: { replicas: 8, updatedReplicas: 2 } });
    expect(percent).toBe(25);
    expect(source).toBe('replicas');
  });

  it('rounds and clamps the replica ratio into 0–100', () => {
    expect(derivePercent({ status: { replicas: 3, updatedReplicas: 1 } }).percent).toBe(33);
    expect(derivePercent({ status: { replicas: 2, updatedReplicas: 5 } }).percent).toBe(100);
  });

  it('returns a null percent rather than 0 when no rule applies', () => {
    expect(derivePercent({})).toEqual({ percent: null, source: null });
    expect(derivePercent({ status: {} })).toEqual({ percent: null, source: null });
    // replicas: 0 would divide by zero
    expect(derivePercent({ status: { replicas: 0, updatedReplicas: 0 } })).toEqual({
      percent: null,
      source: null,
    });
  });

  it('ignores non-finite weights', () => {
    expect(
      derivePercent({
        status: { canary: { weights: { canary: { weight: Number.NaN } } } },
      }),
    ).toEqual({ percent: null, source: null });
  });

  it('ignores an empty step list rather than reporting 100%', () => {
    expect(
      derivePercent({
        spec: { strategy: { canary: { steps: [] } } },
        status: { currentStepIndex: 0 },
      }),
    ).toEqual({ percent: null, source: null });
  });
});

describe('toRolloutProgress', () => {
  it('carries the Argo phase, step position, and replica counts through', () => {
    const progress = toRolloutProgress({
      spec: { strategy: { canary: { steps: [{ setWeight: 20 }, {}, { setWeight: 100 }] } } },
      status: {
        phase: 'Progressing',
        message: 'more replicas need to be updated',
        currentStepIndex: 1,
        replicas: 5,
        updatedReplicas: 1,
        availableReplicas: 4,
      },
    });
    expect(progress).toMatchObject({
      percent: 20,
      source: 'step-weight',
      argoPhase: 'Progressing',
      message: 'more replicas need to be updated',
      currentStepIndex: 1,
      totalSteps: 3,
      replicas: 5,
      updatedReplicas: 1,
      availableReplicas: 4,
      paused: false,
    });
  });

  it('reports paused from spec.paused', () => {
    expect(toRolloutProgress({ spec: { paused: true } }).paused).toBe(true);
  });

  it('reports paused from a pause condition', () => {
    expect(
      toRolloutProgress({ status: { pauseConditions: [{ reason: 'StepPause' }] } }).paused,
    ).toBe(true);
  });

  it('handles a resource carrying no status at all', () => {
    expect(toRolloutProgress({})).toMatchObject({ percent: null, source: null, paused: false });
  });
});
