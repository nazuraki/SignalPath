import type { Stage } from '../../../shared/types.ts';

/** CSS custom property holding each stage's accent color. */
export const STAGE_ACCENT: Record<Stage, string> = {
  backlog: 'var(--c-backlog)',
  progress: 'var(--c-accent)',
  review: 'var(--c-review)',
  pending: 'var(--c-pending)',
  releasing: 'var(--c-releasing)',
  released: 'var(--c-released)',
  done: 'var(--c-done)',
};

/** Short stage labels, sized for a chip. Shared so the dashboard and pipeline agree. */
export const STAGE_LABEL: Record<Stage, string> = {
  backlog: 'backlog',
  progress: 'in prog',
  review: 'review',
  pending: 'pending',
  releasing: 'releasing',
  released: 'released',
  done: 'done',
};
