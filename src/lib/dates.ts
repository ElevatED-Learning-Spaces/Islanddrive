// Trip dates are plain calendar days ('YYYY-MM-DD') in Trinidad time.
// A trip [start, end) runs from pickup day to return day; days = end - start.

export const TZ = 'America/Port_of_Spain';
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(s: unknown): s is string {
  if (typeof s !== 'string' || !ISO.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function toUtc(s: string): number {
  return Date.parse(`${s}T00:00:00Z`);
}

export function daysBetween(start: string, end: string): number {
  return Math.round((toUtc(end) - toUtc(start)) / 86_400_000);
}

export function addDays(s: string, n: number): string {
  return new Date(toUtc(s) + n * 86_400_000).toISOString().slice(0, 10);
}

// Today's date in Trinidad, as 'YYYY-MM-DD'.
export function todayTT(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

// "Sat 10 Jan 2030"
export function prettyDate(s: string): string {
  return new Date(`${s}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

export function prettyRange(start: string, end: string): string {
  return `${prettyDate(start)} → ${prettyDate(end)}`;
}
