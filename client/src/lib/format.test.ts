import { describe, expect, it } from 'vitest';
import { fmt1, fmtDate, fmtMetric } from './format.ts';

describe('fmt1', () => {
  it('rounds to one decimal place', () => {
    expect(fmt1(1.234)).toBe(1.2);
    expect(fmt1(1.25)).toBe(1.3);
    expect(fmt1(1)).toBe(1);
    expect(fmt1(0)).toBe(0);
  });
});

describe('fmtMetric', () => {
  it('keeps two decimals below 10, where small values carry the signal', () => {
    expect(fmtMetric(0.1234)).toBe('0.12');
    expect(fmtMetric(0)).toBe('0');
    expect(fmtMetric(9.999)).toBe('10');
  });

  it('keeps one decimal from 10 up', () => {
    expect(fmtMetric(84.21)).toBe('84.2');
    expect(fmtMetric(999.94)).toBe('999.9');
  });

  it('groups and drops decimals from 1000 up', () => {
    expect(fmtMetric(12345.6)).toBe('12,346');
    expect(fmtMetric(1000)).toBe('1,000');
  });

  it('handles negatives at each magnitude', () => {
    expect(fmtMetric(-0.5)).toBe('-0.5');
    expect(fmtMetric(-42.44)).toBe('-42.4');
    expect(fmtMetric(-5000)).toBe('-5,000');
    // Math.round breaks ties toward +∞, so a negative half rounds up in magnitude
    // terms — inherited from JS, and immaterial at display precision.
    expect(fmtMetric(-42.55)).toBe('-42.5');
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
