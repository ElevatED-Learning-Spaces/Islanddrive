// Trip pricing. The only place a booking's money is worked out; the server
// action calls this with the car row from the database (never client values)
// and stores the result on the booking, where DB CHECKs re-verify the sums.
import { pctOf } from './money';

// Guest-side platform fee and host commission, as whole percents.
// Owner decision pending (DECISIONS.md #3); stored per booking, so changing
// these never re-prices an existing trip.
export const SERVICE_FEE_PCT = 10;
export const HOST_FEE_PCT = 15;
export const WEEKLY_DISCOUNT_MIN_DAYS = 7;

export type PricedCar = {
  daily_rate_cents: number;
  cleaning_fee_cents: number;
  deposit_cents: number;
  weekly_discount_pct: number;
};

export type Quote = {
  days: number;
  daily_rate_cents: number;
  discount_cents: number;
  rental_cents: number;
  cleaning_fee_cents: number;
  service_fee_cents: number;
  total_cents: number;       // what the guest pays the platform
  deposit_cents: number;     // refundable, handled at pickup — not in total
  host_fee_cents: number;
  host_payout_cents: number; // what the host receives
};

export function quoteTrip(
  car: PricedCar,
  days: number,
  fees: { serviceFeePct: number; hostFeePct: number } = { serviceFeePct: SERVICE_FEE_PCT, hostFeePct: HOST_FEE_PCT },
): Quote {
  if (!Number.isInteger(days) || days < 1) throw new Error('a trip is at least one day');
  const base = days * car.daily_rate_cents;
  const discount = days >= WEEKLY_DISCOUNT_MIN_DAYS ? pctOf(base, car.weekly_discount_pct) : 0;
  const rental = base - discount;
  const service = pctOf(rental, fees.serviceFeePct);
  const hostFee = pctOf(rental, fees.hostFeePct);
  return {
    days,
    daily_rate_cents: car.daily_rate_cents,
    discount_cents: discount,
    rental_cents: rental,
    cleaning_fee_cents: car.cleaning_fee_cents,
    service_fee_cents: service,
    total_cents: rental + car.cleaning_fee_cents + service,
    deposit_cents: car.deposit_cents,
    host_fee_cents: hostFee,
    host_payout_cents: rental + car.cleaning_fee_cents - hostFee,
  };
}
