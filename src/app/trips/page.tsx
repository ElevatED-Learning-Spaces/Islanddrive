import type { Metadata } from 'next';
import Link from 'next/link';
import { StatusChip } from '@/components/StatusChip';
import { requireMe } from '@/lib/auth';
import { carTitle } from '@/lib/data';
import { prettyRange } from '@/lib/dates';
import { ttd } from '@/lib/money';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Your trips' };

type Row = { id: string; start_date: string; end_date: string; status: string; total_cents: number; cars: { make: string; model: string; year: number } | null };

export default async function TripsPage() {
  const me = await requireMe('/trips');
  const supabase = await createClient();
  const { data } = await supabase
    .from('bookings')
    .select('id, start_date, end_date, status, total_cents, cars(make, model, year)')
    .eq('guest_id', me.id)
    .order('start_date', { ascending: false })
    .limit(100);
  const rows = (data ?? []) as unknown as Row[];
  const upcoming = rows.filter((r) => ['requested', 'approved', 'paid', 'active'].includes(r.status));
  const past = rows.filter((r) => !upcoming.includes(r));
  return (
    <div className="page max-w-3xl space-y-8">
      <h1 className="h1">Your trips</h1>
      {!rows.length ? (
        <div className="card p-8 text-center">
          <p className="font-semibold">No trips yet.</p>
          <Link href="/cars" className="btn-primary mt-4">Find a car</Link>
        </div>
      ) : null}
      {[['Upcoming', upcoming], ['Past', past] as const].map(([label, list]) =>
        (list as Row[]).length ? (
          <section key={label as string}>
            <h2 className="h2 mb-3">{label as string}</h2>
            <ul className="card divide-y divide-line">
              {(list as Row[]).map((r) => (
                <li key={r.id}>
                  <Link href={`/bookings/${r.id}`} className="flex flex-wrap items-center gap-3 p-4 hover:bg-sand/60">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{r.cars ? carTitle(r.cars) : 'Car'}</div>
                      <div className="muted">{prettyRange(r.start_date, r.end_date)}</div>
                    </div>
                    <div className="text-sm font-semibold">{ttd(r.total_cents)}</div>
                    <StatusChip kind="booking" code={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
    </div>
  );
}
