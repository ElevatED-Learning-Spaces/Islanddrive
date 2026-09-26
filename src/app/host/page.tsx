import type { Metadata } from 'next';
import Link from 'next/link';
import { CarImage } from '@/components/CarImage';
import { StatusChip } from '@/components/StatusChip';
import { getMe } from '@/lib/auth';
import { carTitle, photoUrl } from '@/lib/data';
import { prettyRange, todayTT } from '@/lib/dates';
import { supabaseConfigured } from '@/lib/env';
import { ttd } from '@/lib/money';
import { HOST_FEE_PCT } from '@/lib/pricing';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Host' };

type B = { id: string; start_date: string; end_date: string; status: string; host_payout_cents: number; cars: { make: string; model: string; year: number } | null };

export default async function HostPage() {
  const me = await getMe();
  if (!me) return <Pitch signedIn={false} />;
  const supabase = await createClient();
  const today = todayTT();
  const [{ data: cars }, { data: bookings }, { data: payouts }] = await Promise.all([
    supabase.from('cars').select('id, make, model, year, status, daily_rate_cents, car_photos(path, position)').eq('host_id', me.id).order('created_at'),
    supabase.from('bookings').select('id, start_date, end_date, status, host_payout_cents, cars(make, model, year)').eq('host_id', me.id).order('start_date').limit(200),
    supabase.from('host_payouts').select('booking_id, amount_cents').eq('host_id', me.id),
  ]);
  if (!cars?.length && !bookings?.length) return <Pitch signedIn />;

  const list = (bookings ?? []) as unknown as B[];
  const requests = list.filter((b) => b.status === 'requested');
  const upcoming = list.filter((b) => ['approved', 'paid', 'active'].includes(b.status) && b.end_date >= today);
  const paidOut = new Set((payouts ?? []).map((p) => p.booking_id));
  const completed = list.filter((b) => b.status === 'completed');
  const earned = completed.reduce((s, b) => s + b.host_payout_cents, 0);
  const owed = completed.filter((b) => !paidOut.has(b.id)).reduce((s, b) => s + b.host_payout_cents, 0);

  return (
    <div className="page space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="h1 mr-auto">Host dashboard</h1>
        <Link href="/host/cars/new" className="btn-primary">+ Add a car</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Requests to answer" value={String(requests.length)} />
        <Stat label="Earned (completed trips)" value={ttd(earned)} />
        <Stat label="Payout pending" value={ttd(owed)} />
      </div>

      {requests.length ? <BookingList title="Requests waiting for you" rows={requests} highlight /> : null}
      {upcoming.length ? <BookingList title="Upcoming trips" rows={upcoming} /> : null}

      <section>
        <h2 className="h2 mb-3">Your cars</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(cars ?? []).map((c) => {
            const ph = [...(c.car_photos ?? [])].sort((a, b) => a.position - b.position)[0];
            return (
              <Link key={c.id} href={`/host/cars/${c.id}`} className="card overflow-hidden hover:shadow-lg">
                <div className="aspect-[16/9]"><CarImage src={ph ? photoUrl(ph.path) : null} alt={carTitle(c)} /></div>
                <div className="flex items-center justify-between gap-2 p-4">
                  <div>
                    <div className="font-semibold">{carTitle(c)}</div>
                    <div className="muted">{ttd(c.daily_rate_cents, { whole: true })} / day</div>
                  </div>
                  <StatusChip kind="car" code={c.status} />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
      {completed.length ? <BookingList title="Completed" rows={completed.slice(-20).reverse()} /> : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function BookingList({ title, rows, highlight }: { title: string; rows: B[]; highlight?: boolean }) {
  return (
    <section>
      <h2 className="h2 mb-3">{title}</h2>
      <ul className={`card divide-y divide-line ${highlight ? 'ring-2 ring-sun/40' : ''}`}>
        {rows.map((b) => (
          <li key={b.id}>
            <Link href={`/bookings/${b.id}`} className="flex flex-wrap items-center gap-3 p-4 hover:bg-sand/60">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{b.cars ? carTitle(b.cars) : 'Car'}</div>
                <div className="muted">{prettyRange(b.start_date, b.end_date)}</div>
              </div>
              <div className="text-sm font-semibold">{ttd(b.host_payout_cents)}</div>
              <StatusChip kind="booking" code={b.status} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Pitch({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="page max-w-3xl">
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-br from-ink to-sea-700 p-8 text-white sm:p-10">
          <h1 className="text-3xl font-extrabold tracking-tight">Earn from your car when you’re not using it.</h1>
          <p className="mt-3 max-w-xl text-white/80">List it free. You set the daily price and the dates; you approve every guest; we check every driver’s permit.</p>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-3">
          {[
            ['You’re in control', 'Approve or decline every request. Block the days you need the car.'],
            ['Paid after each trip', `You keep ${100 - HOST_FEE_PCT}% of the rental and cleaning fee, paid to your bank account.`],
            ['Verified guests', 'Every guest’s driver’s permit is checked before they can book.'],
          ].map(([t, d]) => (
            <div key={t}>
              <h3 className="font-bold">{t}</h3>
              <p className="muted mt-1">{d}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-line p-6">
          {!supabaseConfigured() ? (
            <p className="muted">Demo mode — hosting is switched off.</p>
          ) : (
            <Link href={signedIn ? '/host/cars/new' : '/login?next=/host/cars/new'} className="btn-primary">List your car</Link>
          )}
        </div>
      </div>
    </div>
  );
}
