// Money is integer cents (TTD). Never floats in storage or arithmetic.

// pct% of an integer amount, rounded half-up, in integer arithmetic only.
export function pctOf(cents: number, pct: number): number {
  if (!Number.isInteger(cents) || cents < 0) throw new Error('amount must be non-negative integer cents');
  if (!Number.isInteger(pct) || pct < 0 || pct > 100) throw new Error('percent must be an integer 0–100');
  return Math.floor((cents * pct + 50) / 100);
}

const fmt = new Intl.NumberFormat('en-TT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtWhole = new Intl.NumberFormat('en-TT', { maximumFractionDigits: 0 });

// "TT$1,234.50" — or "TT$1,235" with whole: true (list cards).
export function ttd(cents: number, opts: { whole?: boolean } = {}): string {
  const v = cents / 100;
  return `TT$${opts.whole && cents % 100 === 0 ? fmtWhole.format(v) : fmt.format(v)}`;
}

// Parse "350", "350.5", "1,200.00" typed by a person into cents; null if invalid.
export function parseTtd(raw: string | null | undefined): number | null {
  const t = (raw ?? '').replace(/[,\s]/g, '').replace(/^TT\$|^\$/i, '');
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(t)) return null;
  const [whole, frac = ''] = t.split('.');
  return Number(whole) * 100 + Number((frac + '00').slice(0, 2));
}
