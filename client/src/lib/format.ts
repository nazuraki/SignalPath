export const fmtDate = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const fmt1 = (n: number): number => Math.round(n * 10) / 10;
