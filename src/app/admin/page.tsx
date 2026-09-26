import type { Metadata } from 'next';
import Link from 'next/link';
import { Flash } from '@/components/Flash';
import { StatusChip } from '@/components/StatusChip';
import { SubmitButton } from '@/components/SubmitButton';
import { requireAdmin } from '@/lib/auth';
import { carTitle } from '@/lib/data';
import { prettyRange } from '@/lib/dates';
import { ttd } from '@/lib/money';
import { prettyPhone } from '@/lib/phone';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordPayout, reviewCar, reviewPayment, reviewPermit } from './actions';

export const metadata: Metadata = { title: 'Admin' };

type CarRef = { make: string; model: string; year: number } | null;

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const admin = createAdminClient();
  const [cars, permits, payments, completed, payouts, recent] = await Promise.all([
    admin.from('cars').select('id, make, model, year, area, daily_rate_cents, host_id, profiles!cars_host_id_fkey(full_name, phone), car_photos(id)').eq('status', 'pending_review').order('updated_at'),
    admin.from('profiles').select('id, full_name, phone, permit_path, updated_at').eq('permit_status', 'pending').order('updated_at'),
    admin.from('payments').select('id, booking_id, amount_cents, reference, proof_path, created_at, profiles!payments_payer_id_fkey(full_name)').eq('status', 'submitted').order('created_at'),
    admin.from('bookings').select('id, host_id, host_payout_cents, end_date, cars(make, model, year), profiles!bookings_host_id_fkey(full_name)').eq('status', 'completed').order('end_date'),
    admin.from('host_payouts').select('booking_id'),
    admin.from('bookings').select('id, start_date, end_date, status, total_cents, cars(make, model, year)').order('created_at', { ascending: false }).limit(25),
  ]);

  // Private files: short-lived signed links, generated only for admins.
  const sign = async (bucket: string, path: string | null) =>
    path ? (await admin.storage.from(bucket).createSignedUrl(path, 60 * 30)).data?.signedUrl ?? null : null;
  const permitRows = await Promise.all((permits.data ?? []).map(async (p) => ({ ...p, url: await sign('permits', p.permit_path) })));
  const paymentRows = await Promise.all((payments.data ?? []).map(async (p) => ({ ...p, url: await sign('proofs', p.proof_path) })));
  const paid = new Set((payouts.data ?? []).map((p) => p.booking_id));
  const owed = ((completed.data ?? []) as unknown as { id: string; host_payout_cents: number; end_date: string; cars: CarRef; profiles: { full_name: string | null } | null }[]).filter((b) => !paid.has(b.id));

  return (
    <div className="page space-y-8">
      <h1 className="h1">Admin</h1>
      <Flash ok={sp.ok} error={sp.error} />

      <Queue title="Payments to check" count={paymentRows.length} empty="No payments waiting.">
        {paymentRows.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{ttd(p.amount_cents)} · {(p.profiles as unknown as { full_name: string | null } | null)?.full_name ?? 'Guest'}</div>
              <div className="muted">Ref ID-{p.booking_id.slice(0, 8).toUpperCase()}{p.reference ? ` · theirs: ${p.reference}` : ''} · <Link className="underline" href={`/bookings/${p.booking_id}`}>trip</Link> · {p.url ? <a className="underline" href={p.url} target="_blank" rel="noopener noreferrer">receipt</a> : 'no file'}</div>
            </div>
            <Decide action={reviewPayment} id={p.id} approveText="Confirm" />
          </li>
        ))}
      </Queue>

      <Queue title="Driver’s permits" count={permitRows.length} empty="No permits waiting.">
        {permitRows.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{p.full_name ?? 'No name yet'}</div>
              <div className="muted">{p.phone ? prettyPhone(p.phone) : 'no phone'} · {p.url ? <a className="underline" href={p.url} target="_blank" rel="noopener noreferrer">view permit</a> : 'no file'}</div>
            </div>
            <Decide action={reviewPermit} id={p.id} approveText="Verify" />
          </li>
        ))}
      </Queue>

      <Queue title="Listings to review" count={cars.data?.length ?? 0} empty="No listings waiting.">
        {(cars.data ?? []).map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="font-semibold"><Link className="hover:underline" href={`/cars/${c.id}`}>{carTitle(c)}</Link></div>
              <div className="muted">{ttd(c.daily_rate_cents, { whole: true })}/day · {c.car_photos?.length ?? 0} photos · host {(c.profiles as unknown as { full_name: string | null } | null)?.full_name ?? '—'}</div>
            </div>
            <Decide action={reviewCar} id={c.id} approveText="List it" />
          </li>
        ))}
      </Queue>

      <Queue title="Host payouts owed" count={owed.length} empty="All hosts are paid.">
        {owed.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{ttd(b.host_payout_cents)} → {b.profiles?.full_name ?? 'Host'}</div>
              <div className="muted">{b.cars ? carTitle(b.cars) : ''} · returned {b.end_date} · <Link className="underline" href={`/bookings/${b.id}`}>trip</Link></div>
            </div>
            <form action={recordPayout} className="flex gap-2">
              <input type="hidden" name="booking_id" value={b.id} />
              <input name="reference" placeholder="Transfer ref" className="input !w-36 !py-1.5" />
              <SubmitButton className="btn-primary !py-1.5">Mark paid</SubmitButton>
            </form>
          </li>
        ))}
      </Queue>

      <section>
        <h2 className="h2 mb-3">Latest bookings</h2>
        <ul className="card divide-y divide-line">
          {((recent.data ?? []) as unknown as { id: string; start_date: string; end_date: string; status: string; total_cents: number; cars: CarRef }[]).map((b) => (
            <li key={b.id}>
              <Link href={`/bookings/${b.id}`} className="flex flex-wrap items-center gap-3 p-3 text-sm hover:bg-sand/60">
                <span className="min-w-0 flex-1 font-medium">{b.cars ? carTitle(b.cars) : 'Car'} · {prettyRange(b.start_date, b.end_date)}</span>
                <span>{ttd(b.total_cents)}</span>
                <StatusChip kind="booking" code={b.status} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Queue({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="h2 mb-3">{title} {count ? <span className="chip ml-1 bg-amber-50 text-amber-800">{count}</span> : null}</h2>
      {count ? <ul className="card divide-y divide-line">{children}</ul> : <p className="muted">{empty}</p>}
    </section>
  );
}

function Decide({ action, id, approveText }: { action: (f: FormData) => Promise<void>; id: string; approveText: string }) {
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input name="note" placeholder="Note (needed to reject)" className="input !w-48 !py-1.5" maxLength={500} />
      <SubmitButton name="decision" value="approve" className="btn-primary !py-1.5">{approveText}</SubmitButton>
      <SubmitButton name="decision" value="reject" className="btn-danger !py-1.5">Reject</SubmitButton>
    </form>
  );
}
