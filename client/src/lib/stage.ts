import type { Issue, Stage } from '../../../shared/types.ts';

export type { Stage };

export const STAGE_ORDER: readonly Stage[] = [
  'backlog',
  'progress',
  'review',
  'pending',
  'releasing',
  'released',
  'done',
] as const;

/**
 * Classify an issue into a SignalPath pipeline stage.
 *
 * Precedence:
 *  1. Exact case-insensitive match against `stageMap` (config-driven).
 *  2. `resolutiondate` present → `done`.
 *  3. Heuristic substring match on status: "review", "progress"/"doing".
 *  4. Default → `backlog`.
 */
export function stageOf(issue: Issue, stageMap: Record<string, Stage>): Stage {
  const lower = issue.status.toLowerCase();
  const mapped = stageMap[lower];
  if (mapped) return mapped;
  if (issue.resolutiondate) return 'done';
  if (lower.includes('review')) return 'review';
  if (lower.includes('progress') || lower.includes('doing')) return 'progress';
  return 'backlog';
}
