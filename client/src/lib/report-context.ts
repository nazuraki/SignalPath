import { createContext, useCallback, useContext, useState } from 'react';
import type { WorkdayReport } from '../../../shared/types.ts';

/** Workday report state, held above the router so it survives page swaps. */
export interface ReportData {
  report: WorkdayReport | null;
  loading: boolean;
  error: string | null;
  date: string;
  setDate: (d: string) => void;
  run: () => void;
}

export const ReportContext = createContext<ReportData | null>(null);

export const useReport = (): ReportData => {
  const ctx = useContext(ReportContext);
  if (!ctx) throw new Error('useReport must be used within a ReportContext provider');
  return ctx;
};

/**
 * Owns the report state. Call once above the routes so a fetched report is kept
 * for reference when navigating between pages; the report is never fetched
 * automatically, only when `run` is called.
 */
export function useReportState(): ReportData {
  const [report, setReport] = useState<WorkdayReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState<string>('');

  const run = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const url = date ? `/api/report?date=${encodeURIComponent(date)}` : '/api/report';
      const r = await fetch(url);
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`HTTP ${r.status}: ${t.slice(0, 400)}`);
      }
      setReport((await r.json()) as WorkdayReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [date]);

  return { report, loading, error, date, setDate, run };
}
