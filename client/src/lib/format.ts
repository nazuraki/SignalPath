export const fmtDate = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const fmt1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Compact display for a metric value — useful precision at any magnitude without
 * a wall of decimals. 0.1234 → "0.12", 84.21 → "84.2", 12345 → "12,345".
 */
export const fmtMetric = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1000) return Math.round(n).toLocaleString('en-US');
  if (abs >= 10) return String(Math.round(n * 10) / 10);
  return String(Math.round(n * 100) / 100);
};
