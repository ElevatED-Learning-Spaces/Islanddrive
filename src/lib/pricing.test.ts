import { describe, it, expect } from 'vitest';
import { quoteTrip } from './pricing';
import { pctOf, parseTtd, ttd } from './money';

const car = { daily_rate_cents: 35000, cleaning_fee_cents: 5000, deposit_cents: 100000, weekly_discount_pct: 10 };

describe('pctOf', () => {
  it('rounds half up in integer maths', () => {
    expect(pctOf(105, 10)).toBe(11); // 10.5 → 11
    expect(pctOf(104, 10)).toBe(10);
    expect(pctOf(1, 50)).toBe(1); // 0.5 → 1
    expect(pctOf(0, 15)).toBe(0);
  });
  it('rejects fractional cents and bad percents', () => {
    expect(() => pctOf(1.5, 10)).toThrow();
    expect(() => pctOf(-1, 10)).toThrow();
    expect(() => pctOf(100, 101)).toThrow();
  });
});

describe('quoteTrip', () => {
  it('prices a 3-day trip to the cent', () => {
    const q = quoteTrip(car, 3);
    expect(q).toEqual({
      days: 3,
      daily_rate_cents: 35000,
      discount_cents: 0,
      rental_cents: 105000,
      cleaning_fee_cents: 5000,
      service_fee_cents: 10500,
      total_cents: 120500,
      deposit_cents: 100000,
      host_fee_cents: 15750,
      host_payout_cents: 94250,
    });
  });

  it('applies the weekly discount from 7 days, not before', () => {
    expect(quoteTrip(car, 6).discount_cents).toBe(0);
    const q = quoteTrip(car, 7);
    expect(q.discount_cents).toBe(24500); // 10% of 245,000
    expect(q.rental_cents).toBe(220500);
    expect(q.service_fee_cents).toBe(22050);
    expect(q.total_cents).toBe(220500 + 5000 + 22050);
  });

  it('keeps the identities the database CHECKs enforce', () => {
    for (let days = 1; days <= 40; days++) {
      for (const rate of [5000, 12345, 35099, 99999]) {
        const q = quoteTrip({ ...car, daily_rate_cents: rate, weekly_discount_pct: 15 }, days);
        expect(q.rental_cents).toBe(days * rate - q.discount_cents);
        expect(q.total_cents).toBe(q.rental_cents + q.cleaning_fee_cents + q.service_fee_cents);
        expect(q.host_payout_cents).toBe(q.rental_cents + q.cleaning_fee_cents - q.host_fee_cents);
        for (const v of Object.values(q)) expect(Number.isInteger(v) && v >= 0).toBe(true);
      }
    }
  });

  it('deposit is never part of the amount paid to the platform', () => {
    const q = quoteTrip(car, 2);
    expect(q.total_cents).toBe(q.rental_cents + q.cleaning_fee_cents + q.service_fee_cents);
  });

  it('rejects zero or fractional days', () => {
    expect(() => quoteTrip(car, 0)).toThrow();
    expect(() => quoteTrip(car, 1.5)).toThrow();
  });
});

describe('money formatting', () => {
  it('formats and parses TTD', () => {
    expect(ttd(120500)).toBe('TT$1,205.00');
    expect(ttd(35000, { whole: true })).toBe('TT$350');
    expect(parseTtd('350')).toBe(35000);
    expect(parseTtd('1,200.5')).toBe(120050);
    expect(parseTtd('TT$99.99')).toBe(9999);
    expect(parseTtd('12.345')).toBeNull();
    expect(parseTtd('abc')).toBeNull();
    expect(parseTtd('')).toBeNull();
  });
});
