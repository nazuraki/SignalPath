import { createContext, useContext } from 'react';
import type { WorkstreamPair } from '../../../shared/types.ts';

/** Burndown data shared across the dashboard and parity pages. */
export interface DashboardData {
  pairs: WorkstreamPair[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
  activeWorkstream: string | null;
  setActiveWorkstream: (key: string | null) => void;
}

export const DashboardContext = createContext<DashboardData | null>(null);

export const useDashboard = (): DashboardData => {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within a DashboardContext provider');
  return ctx;
};
