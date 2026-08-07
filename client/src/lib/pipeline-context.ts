import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { PipelineResponse } from '../../../shared/types.ts';

/** Release-control pipeline state, held above the router so it survives page swaps. */
export interface PipelineData {
  pipeline: PipelineResponse | null;
  loading: boolean;
  error: string | null;
  /** Wall-clock of the last successful fetch. */
  lastUpdated: Date | null;
  refresh: () => void;
}

export const PipelineContext = createContext<PipelineData | null>(null);

export const usePipeline = (): PipelineData => {
  const ctx = useContext(PipelineContext);
  if (!ctx) throw new Error('usePipeline must be used within a PipelineContext provider');
  return ctx;
};

/** True while any listed release is still moving — the only time re-polling earns its cost. */
function hasLiveRollout(pipeline: PipelineResponse | null): boolean {
  if (!pipeline) return false;
  return pipeline.items.some(
    (i) =>
      i.stage === 'releasing' ||
      i.release?.phase === 'running' ||
      i.rollout?.argoPhase === 'Progressing' ||
      i.rollout?.paused === true,
  );
}

/**
 * Owns the pipeline state. Fetches on mount, then re-polls every `pollSeconds`
 * but *only* while something is mid-flight: each poll costs a kubectl shell-out
 * per service, so an idle page must stay quiet. Pass pollSeconds = 0 to disable.
 */
export function usePipelineState(enabled: boolean, pollSeconds: number): PipelineData {
  const [pipeline, setPipeline] = useState<PipelineResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  // Read inside the interval callback so the timer doesn't restart on every fetch.
  const liveRef = useRef(false);
  liveRef.current = hasLiveRollout(pipeline);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/pipeline');
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`HTTP ${r.status}: ${t.slice(0, 400)}`);
      }
      setPipeline((await r.json()) as PipelineResponse);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled || pollSeconds <= 0) return;
    const id = setInterval(() => {
      if (liveRef.current) refresh();
    }, pollSeconds * 1000);
    return () => clearInterval(id);
  }, [enabled, pollSeconds, refresh]);

  return { pipeline, loading, error, lastUpdated, refresh };
}
