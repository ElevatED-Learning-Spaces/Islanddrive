import { addDays, daysBetween, isIsoDate } from './dates';

// Half-open [start, end) ranges of 'YYYY-MM-DD' strings.
export type Range = { start_date: string; end_date: string };

export function overlaps(a: Range, b: Range): boolean {
  return a.start_date < b.end_date && b.start_date < a.end_date;
}

// Host blocks are stored inclusive; make them half-open like trips.
export function blockToRange(b: Range): Range {
  return { start_date: b.start_date, end_date: addDays(b.end_date, 1) };
}

export const MAX_ADVANCE_DAYS = 365;

// Why a requested trip is not allowed, or null when it is. Pure — callers pass
// today's date and the busy ranges they loaded.
export function tripProblem(input: {
  start: unknown;
  end: unknown;
  today: string;
  minDays: number;
  maxDays: number;
  busy: Range[];
}): string | null {
  const { start, end, today, minDays, maxDays, busy } = input;
  if (!isIsoDate(start) || !isIsoDate(end)) return 'Choose a pickup and a return date.';
  if (start <= today) return 'Pickup must be from tomorrow onward.';
  if (end <= start) return 'Return must be after pickup.';
  if (daysBetween(today, start) > MAX_ADVANCE_DAYS) return 'Trips can be booked up to a year ahead.';
  const days = daysBetween(start, end);
  if (days < minDays) return `This car needs at least ${minDays} day${minDays === 1 ? '' : 's'}.`;
  if (days > maxDays) return `This car can be booked for at most ${maxDays} days.`;
  if (busy.some((r) => overlaps({ start_date: start, end_date: end }, r))) {
    return 'The car is not available for those dates.';
  }
  return null;
}
