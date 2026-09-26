import { describe, it, expect } from 'vitest';
import { blockToRange, overlaps, tripProblem } from './availability';
import { addDays, daysBetween, isIsoDate, todayTT } from './dates';

const base = { today: '2030-01-01', minDays: 2, maxDays: 14, busy: [] };

describe('overlaps (half-open)', () => {
  it('back-to-back trips do not overlap', () => {
    expect(overlaps({ start_date: '2030-01-10', end_date: '2030-01-13' }, { start_date: '2030-01-13', end_date: '2030-01-15' })).toBe(false);
  });
  it('a shared day overlaps', () => {
    expect(overlaps({ start_date: '2030-01-10', end_date: '2030-01-14' }, { start_date: '2030-01-13', end_date: '2030-01-15' })).toBe(true);
  });
  it('an inclusive host block covers its last day', () => {
    const block = blockToRange({ start_date: '2030-03-05', end_date: '2030-03-06' });
    expect(overlaps({ start_date: '2030-03-06', end_date: '2030-03-08' }, block)).toBe(true);
    expect(overlaps({ start_date: '2030-03-07', end_date: '2030-03-08' }, block)).toBe(false);
  });
});

describe('tripProblem', () => {
  it('accepts a valid trip', () => {
    expect(tripProblem({ ...base, start: '2030-01-05', end: '2030-01-08' })).toBeNull();
  });
  it('rejects bad input, past dates, and reversed ranges', () => {
    expect(tripProblem({ ...base, start: 'x', end: '2030-01-08' })).toMatch(/pickup/i);
    expect(tripProblem({ ...base, start: '2030-02-30', end: '2030-03-02' })).toMatch(/pickup/i);
    expect(tripProblem({ ...base, start: '2030-01-01', end: '2030-01-04' })).toMatch(/tomorrow/);
    expect(tripProblem({ ...base, start: '2030-01-08', end: '2030-01-05' })).toMatch(/after pickup/);
  });
  it('enforces min/max days and the one-year horizon', () => {
    expect(tripProblem({ ...base, start: '2030-01-05', end: '2030-01-06' })).toMatch(/at least 2 days/);
    expect(tripProblem({ ...base, start: '2030-01-05', end: '2030-01-25' })).toMatch(/at most 14/);
    expect(tripProblem({ ...base, start: '2031-06-01', end: '2031-06-04' })).toMatch(/year/);
  });
  it('rejects busy dates', () => {
    const busy = [{ start_date: '2030-01-06', end_date: '2030-01-07' }];
    expect(tripProblem({ ...base, busy, start: '2030-01-05', end: '2030-01-08' })).toMatch(/not available/);
    expect(tripProblem({ ...base, busy, start: '2030-01-07', end: '2030-01-09' })).toBeNull();
  });
});

describe('dates', () => {
  it('validates and does arithmetic across month/leap boundaries', () => {
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2027-02-29')).toBe(false);
    expect(addDays('2028-02-28', 2)).toBe('2028-03-01');
    expect(daysBetween('2030-12-30', '2031-01-02')).toBe(3);
  });
  it('today is taken in Trinidad time', () => {
    // 02:00 UTC on 1 Jan is still 31 Dec in Port of Spain (UTC-4).
    expect(todayTT(new Date('2030-01-01T02:00:00Z'))).toBe('2029-12-31');
  });
});
