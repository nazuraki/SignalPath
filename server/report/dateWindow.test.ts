import { describe, expect, it } from 'vitest';
import { nextDay, previousWorkday, ymd } from './dateWindow.ts';

// Local-time noon avoids any DST/midnight edge — getDay() is what we assert on.
const at = (iso: string) => new Date(`${iso}T12:00:00`);

describe('previousWorkday', () => {
  it('maps Monday to the preceding Friday', () => {
    // 2026-07-20 is a Monday.
    const w = previousWorkday(at('2026-07-20'));
    expect(w.startDate).toBe('2026-07-17'); // Friday
    expect(w.endDate).toBe('2026-07-17');
    expect(w.isFriday).toBe(true);
  });

  it('maps Tuesday–Friday to the previous day', () => {
    // 2026-07-22 is a Wednesday → Tuesday.
    const w = previousWorkday(at('2026-07-22'));
    expect(w.startDate).toBe('2026-07-21');
    expect(w.isFriday).toBe(false);
  });

  it('reports Friday as isFriday when today is Saturday', () => {
    // 2026-07-25 is a Saturday → Friday.
    const w = previousWorkday(at('2026-07-25'));
    expect(w.startDate).toBe('2026-07-24'); // Friday
    expect(w.isFriday).toBe(true);
  });

  it('maps Sunday to the preceding Friday', () => {
    // 2026-07-26 is a Sunday → Friday two days back.
    const w = previousWorkday(at('2026-07-26'));
    expect(w.startDate).toBe('2026-07-24'); // Friday
    expect(w.isFriday).toBe(true);
  });

  it('honors an explicit date override verbatim', () => {
    const w = previousWorkday(at('2026-07-22'), '2026-07-17');
    expect(w.startDate).toBe('2026-07-17');
    expect(w.endDate).toBe('2026-07-17');
    expect(w.isFriday).toBe(true); // 2026-07-17 is a Friday
  });

  it('crosses a month boundary correctly', () => {
    // 2026-08-03 is a Monday → 2026-07-31 (Friday).
    const w = previousWorkday(at('2026-08-03'));
    expect(w.startDate).toBe('2026-07-31');
  });
});

describe('date helpers', () => {
  it('ymd formats local date parts', () => {
    expect(ymd(at('2026-01-05'))).toBe('2026-01-05');
  });

  it('nextDay returns the following calendar day, crossing months', () => {
    expect(nextDay('2026-07-17')).toBe('2026-07-18');
    expect(nextDay('2026-07-31')).toBe('2026-08-01');
  });
});
