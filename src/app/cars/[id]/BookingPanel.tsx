'use client';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { SubmitButton } from '@/components/SubmitButton';
import { tripProblem, type Range } from '@/lib/availability';
import { addDays, daysBetween, isIsoDate } from '@/lib/dates';
import { ttd } from '@/lib/money';
import { quoteTrip, WEEKLY_DISCOUNT_MIN_DAYS, type PricedCar } from '@/lib/pricing';
import { requestBooking, type RequestState } from './actions';

type Props = {
  carId: string;
  car: PricedCar & { min_days: number; max_days: number };
  busy: Range[];
  today: string;
  initial: { start?: string; end?: string };
  blocker: { text: string; href?: string; cta?: string } | null;
};

// Live price preview for the guest. The server recomputes everything on submit.
export function BookingPanel({ carId, car, busy, today, initial, blocker }: Props) {
  const [start, setStart] = useState(initial.start ?? '');
  const [end, setEnd] = useState(initial.end ?? '');
  const [state, action] = useActionState<RequestState, FormData>(requestBooking, { error: null });

  const filled = isIsoDate(start) && isIsoDate(end);
  const problem = filled ? tripProblem({ start, end, today, minDays: car.min_days, maxDays: car.max_days, busy }) : null;
  const q = filled && !problem ? quoteTrip(car, daysBetween(start, end)) : null;

  return (
    <form action={action} className="card space-y-4 p-5">
      <input type="hidden" name="car_id" value={carId} />
      <div>
        <span className="text-2xl font-bold">{ttd(car.daily_rate_cents, { whole: true })}</span>
        <span className="muted"> / day</span>
        {car.weekly_discount_pct > 0 ? (
          <p className="text-xs text-sea-700">{car.weekly_discount_pct}% off trips of {WEEKLY_DISCOUNT_MIN_DAYS}+ days</p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="bp-start">Pickup</label>
          <input id="bp-start" name="start" type="date" className="input" min={addDays(today, 1)} value={start}
            onChange={(e) => { setStart(e.target.value); if (end && e.target.value >= end) setEnd(''); }} required />
        </div>
        <div>
          <label className="label" htmlFor="bp-end">Return</label>
          <input id="bp-end" name="end" type="date" className="input" min={start ? addDays(start, 1) : addDays(today, 2)} value={end}
            onChange={(e) => setEnd(e.target.value)} required />
        </div>
      </div>
      {problem ? <p className="text-sm text-coral">{problem}</p> : null}
      {q ? (
        <dl className="space-y-1.5 border-t border-line pt-3 text-sm">
          <Row k={`${ttd(q.daily_rate_cents)} × ${q.days} day${q.days === 1 ? '' : 's'}`} v={ttd(q.days * q.daily_rate_cents)} />
          {q.discount_cents ? <Row k="Weekly discount" v={`−${ttd(q.discount_cents)}`} /> : null}
          {q.cleaning_fee_cents ? <Row k="Cleaning fee" v={ttd(q.cleaning_fee_cents)} /> : null}
          <Row k="Service fee" v={ttd(q.service_fee_cents)} />
          <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
            <dt>Total</dt><dd>{ttd(q.total_cents)}</dd>
          </div>
          {q.deposit_cents ? (
            <p className="text-xs text-ink-soft">Plus a refundable {ttd(q.deposit_cents)} security deposit, paid to the host at pickup.</p>
          ) : null}
        </dl>
      ) : null}
      <div>
        <label className="label" htmlFor="bp-msg">Message to host (optional)</label>
        <textarea id="bp-msg" name="message" rows={2} maxLength={1000} className="input" placeholder="Where you’re heading, pickup time…" />
      </div>
      {state.error ? <p role="alert" className="notice border-red-200 bg-red-50 text-red-800">{state.error}</p> : null}
      {blocker ? (
        <div className="notice border-amber-200 bg-amber-50 text-amber-900">
          {blocker.text}
          {blocker.href ? <> <Link className="font-semibold underline" href={blocker.href}>{blocker.cta}</Link></> : null}
        </div>
      ) : (
        <SubmitButton className="btn-primary w-full" pendingText="Sending request…">Request to book</SubmitButton>
      )}
      <p className="text-center text-xs text-ink-soft">You won’t pay anything until the host approves.</p>
    </form>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-ink-soft">
      <dt>{k}</dt><dd className="text-ink">{v}</dd>
    </div>
  );
}
