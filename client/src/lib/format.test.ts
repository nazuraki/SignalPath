import { describe, expect, it } from 'vitest';
import { fmt1, fmtDate } from './format.ts';

describe('fmt1', () => {
  it('rounds to one decimal place', () => {
    expect(fmt1(1.234)).toBe(1.2);
    expect(fmt1(1.25)).toBe(1.3);
    expect(fmt1(1)).toBe(1);
    expect(fmt1(0)).toBe(0);
  });
});

describe('fmtDate', () => {
  it('returns null for nullish input', () => {
    expect(fmtDate(null)).toBeNull();
    expect(fmtDate('')).toBeNull();
    expect(fmtDate(undefined)).toBeNull();
  });

  it('formats a YYYY-MM-DD date in en-US short style', () => {
    expect(fmtDate('2025-01-15')).toBe('Jan 15');
    expect(fmtDate('2025-12-03')).toBe('Dec 3');
  });
});
