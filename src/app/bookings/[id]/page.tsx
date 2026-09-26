import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CarImage } from '@/components/CarImage';
import { Flash } from '@/components/Flash';
import { StatusChip } from '@/components/StatusChip';
import { SubmitButton } from '@/components/SubmitButton';
import { requireMe } from '@/lib/auth';
import { allowedActions, type Actor, type BookingAction } from '@/lib/booking-status';
import { carTitle, photoUrl } from '@/lib/data';
import { prettyDate, todayTT } from '@/lib/dates';
import { bankDetails, wipayConfigured } from '@/lib/env';
import { labelFor } from '@/lib/labels';
import { ttd } from '@/lib/money';
import { prettyPhone, waLink } from '@/lib/phone';
import { createAdminClient } from '@/lib/supabase/admin';
import { BOOKING_COLUMNS, CAR_COLUMNS, type Booking, type Car } from '@/lib/types';
import { changeBooking, submitProof } from './actions';

export const metadata: Metadata = { title: 'Trip' };

const BUTTON: Record<BookingAction, { text: string; cls: string; confirm?: string }> = {
  approve: { text: 'Approve request', cls: 'btn-primary' },
  decline: { text: 'Decline', cls: 'btn-ghost', confirm: 'Decline this request?' },
  cancel: { text: 'Cancel trip', cls: 'btn-danger', confirm: 'Cancel this trip? This can’t be undone.' },
  start: { text: 'Keys handed over — start trip', cls: 'btn-primary' },
  complete: { text: 'Car returned — complete trip', cls: 'btn-primary' },
  confirm_payment: { text: 'Confirm payment', cls: 'btn-primary' },
};

type Party = { full_name: string | null; phone: string | null; permit_status: string };

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const me = await requireMe(`/bookings/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  // Service role after the party check below; only the fields each side may see are rendered.
  const admin = createAdminClient();
  const { data: bRow } = await admin.from('bookings').select(BOOKING_COLUMNS).eq('id', id).maybeSingle();
  const b = bRow as Booking | null;
  if (!b) notFound();
  const actor: Actor | null =
    b.host_id === me.id ? 'host' : b.guest_id === me.id ? 'guest' : me.profile.role === 'admin' ? 'admin' : null;
  if (!actor) notFound();

  const [{ data: carRow }, { data: photo }, { data: guest }, { data: host }, { data: payments }] = await Promise.all([
    admin.from('cars').select(CAR_COLUMNS).eq('id', b.car_id).single(),
    admin.from('car_photos').select('path').eq('car_id', b.car_id).order('position').limit(1),
    admin.from('profiles').select('full_name, phone, permit_status').eq('id', b.guest_id).single(),
    admin.from('profiles').select('full_name, phone, permit_status').eq('id', b.host_id).single(),
    admin.from('payments').select('id, status, method, reference, review_note, created_at').eq('booking_id', id).order('created_at', { ascending: false }),
  ]);
  const car = carRow as Car;
  const today = todayTT();
  const actions = allowedActions(b, actor === 'admin' ? 'admin' : actor, today).filter((a) => a !== 'confirm_payment');
  const g = guest as Party;
  const h = host as Party;

  // Contact details: the guest sees the host's number once approved; the host sees the guest's while deciding.
  const other = actor === 'guest' ? h : g;
  const contactOpen =
    actor === 'admin' ||
    (actor === 'host' && ['requested', 'approved', 'paid', 'active'].includes(b.status)) ||
    (actor === 'guest' && ['approved', 'paid', 'active'].includes(b.status));
  const title = carTitle(car);
  const pays = (payments ?? []) as { id: string; status: string; reference: string | null; review_note: string | null; created_at: string }[];
  const openPayment = pays.find((p) => p.status === 'submitted');
  const bank = bankDetails();

  return (
    <div className="page max-w-4xl">
      <Link href={actor === 'host' ? '/host' : actor === 'admin' ? '/admin' : '/trips'} className="text-sm text-sea-700 hover:underline">← Back</Link>
      <div className="mt-3"><Flash ok={sp.ok} error={sp.error} /></div>

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="card overflow-hidden">
            <div className="aspect-[16/7]"><CarImage src={photo?.[0] ? photoUrl(photo[0].path) : null} alt={title} /></div>
            <div className="space-y-2 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="h1">{title}</h1>
                <StatusChip kind="booking" code={b.status} />
              </div>
              <p className="text-ink/90">{prettyDate(b.start_date)} → {prettyDate(b.end_date)} · {b.days} day{b.days === 1 ? '' : 's'}</p>
              {b.status_note && ['cancelled', 'declined', 'expired'].includes(b.status) ? <p className="muted">{b.status_note}</p> : null}
              {car.pickup_notes && actor === 'guest' && contactOpen ? <p className="muted">Pickup: {car.pickup_notes}</p> : null}
            </div>
          </div>

          {b.guest_message ? (
            <div className="card p-5">
              <h2 className="h2 mb-1">Message from {actor === 'guest' ? 'you' : (g.full_name ?? 'the guest')}</h2>
              <p className="whitespace-pre-line text-ink/90">{b.guest_message}</p>
            </div>
          ) : null}

          {actor === 'guest' && b.status === 'approved' ? (
            <div className="card space-y-4 p-5">
              <h2 className="h2">Pay to confirm your trip</h2>
              <p className="muted">Transfer <strong className="text-ink">{ttd(b.total_cents)}</strong> and upload the receipt. Your trip is confirmed once we see the payment.</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl bg-sand p-4 text-sm">
                <dt className="text-ink-soft">Bank</dt><dd>{bank.bank}{bank.branch ? `, ${bank.branch}` : ''}</dd>
                <dt className="text-ink-soft">Account name</dt><dd>{bank.accountName}</dd>
                <dt className="text-ink-soft">Account no.</dt><dd className="font-mono">{bank.accountNumber}</dd>
                <dt className="text-ink-soft">Reference</dt><dd className="font-mono">ID-{b.id.slice(0, 8).toUpperCase()}</dd>
              </dl>
              {openPayment ? (
                <p className="notice border-sky-200 bg-sky-50 text-sky-800">We have your receipt and are checking it.</p>
              ) : (
                <form action={submitProof} className="space-y-3">
                  <input type="hidden" name="booking_id" value={b.id} />
                  <div>
                    <label className="label" htmlFor="reference">Transfer reference (optional)</label>
                    <input id="reference" name="reference" className="input" maxLength={120} />
                  </div>
                  <input name="proof" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-sea-50 file:px-4 file:py-2 file:font-semibold file:text-sea-700" />
                  <SubmitButton pendingText="Uploading…">Upload receipt</SubmitButton>
                </form>
              )}
              <p className="text-xs text-ink-soft">{wipayConfigured() ? 'Card payments via WiPay are available.' : 'Card payments (WiPay) are coming soon.'}</p>
            </div>
          ) : null}

          {pays.length ? (
            <div className="card p-5">
              <h2 className="h2 mb-3">Payments</h2>
              <ul className="space-y-2 text-sm">
                {pays.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{labelFor('paymentMethod', 'bank_transfer').label} · {new Date(p.created_at).toLocaleDateString('en-GB')}{p.reference ? ` · ${p.reference}` : ''}</span>
                    <StatusChip kind="payment" code={p.status} />
                    {p.status === 'rejected' && p.review_note ? <p className="w-full text-coral">{p.review_note}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {actions.length ? (
            <div className="card space-y-3 p-5">
              <h2 className="h2">{actor === 'host' && b.status === 'requested' ? 'Your decision' : 'Manage trip'}</h2>
              {actor === 'host' && b.status === 'requested' ? (
                <p className="muted">
                  Guest permit: <StatusChip kind="permit" code={g.permit_status} /> — requests left undecided expire on the pickup date.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {actions.map((a) => (
                  <form key={a} action={changeBooking} className="contents">
                    <input type="hidden" name="booking_id" value={b.id} />
                    <SubmitButton name="action" value={a} className={BUTTON[a].cls} confirm={BUTTON[a].confirm}>{BUTTON[a].text}</SubmitButton>
                  </form>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <aside className="space-y-6">
          <div className="card p-5">
            <h2 className="h2 mb-3">{actor === 'host' ? 'Your earnings' : 'Price'}</h2>
            <dl className="space-y-1.5 text-sm">
              <Row k={`${ttd(b.daily_rate_cents)} × ${b.days}`} v={ttd(b.days * b.daily_rate_cents)} />
              {b.discount_cents ? <Row k="Weekly discount" v={`−${ttd(b.discount_cents)}`} /> : null}
              {b.cleaning_fee_cents ? <Row k="Cleaning fee" v={ttd(b.cleaning_fee_cents)} /> : null}
              {actor === 'host' ? (
                <>
                  <Row k="IslandDrive fee" v={`−${ttd(b.host_fee_cents)}`} />
                  <Total k="You receive" v={ttd(b.host_payout_cents)} />
                </>
              ) : (
                <>
                  <Row k="Service fee" v={ttd(b.service_fee_cents)} />
                  <Total k="Total" v={ttd(b.total_cents)} />
                  {actor === 'admin' ? <Row k="Host payout" v={ttd(b.host_payout_cents)} /> : null}
                </>
              )}
            </dl>
            {b.deposit_cents ? <p className="mt-3 text-xs text-ink-soft">Refundable deposit of {ttd(b.deposit_cents)} is handled between guest and host at pickup.</p> : null}
          </div>

          <div className="card p-5">
            <h2 className="h2 mb-2">{actor === 'guest' ? 'Your host' : actor === 'host' ? 'Your guest' : 'Parties'}</h2>
            {actor === 'admin' ? (
              <div className="space-y-2 text-sm">
                <p>Guest: {g.full_name ?? '—'} {g.phone ? `· ${prettyPhone(g.phone)}` : ''}</p>
                <p>Host: {h.full_name ?? '—'} {h.phone ? `· ${prettyPhone(h.phone)}` : ''}</p>
              </div>
            ) : (
              <>
                <p className="font-semibold">{actor === 'guest' ? (other.full_name?.split(' ')[0] ?? 'Host') : (other.full_name ?? 'Guest')}</p>
                {contactOpen && other.phone ? (
                  <a className="btn-wa mt-3 w-full" target="_blank" rel="noopener noreferrer"
                    href={waLink(other.phone, `Hi ${other.full_name?.split(' ')[0] ?? ''}, it's ${me.profile.full_name?.split(' ')[0] ?? ''} about the ${title} on IslandDrive (${prettyDate(b.start_date)} → ${prettyDate(b.end_date)}).`)}>
                    Message on WhatsApp
                  </a>
                ) : (
                  <p className="muted mt-1">{actor === 'guest' ? 'Contact details appear once your host approves.' : 'Contact details are hidden for closed trips.'}</p>
                )}
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between text-ink-soft"><dt>{k}</dt><dd className="text-ink">{v}</dd></div>;
}
function Total({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between border-t border-line pt-2 text-base font-bold"><dt>{k}</dt><dd>{v}</dd></div>;
}
