'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { allowedActions, targetStatus, type Actor, type BookingAction } from '@/lib/booking-status';
import { busyRangesAdmin } from '@/lib/data';
import { overlaps } from '@/lib/availability';
import { todayTT } from '@/lib/dates';
import { createAdminClient } from '@/lib/supabase/admin';
import { BOOKING_COLUMNS, type Booking } from '@/lib/types';
import { checkUpload } from '@/lib/uploads';

const ACTIONS: BookingAction[] = ['approve', 'decline', 'cancel', 'start', 'complete'];
const OK: Record<BookingAction, string> = {
  approve: 'Approved. The guest has been asked to pay.',
  decline: 'Request declined.',
  cancel: 'Trip cancelled.',
  start: 'Trip started — enjoy the drive!',
  complete: 'Trip completed. Thanks for hosting!',
  confirm_payment: 'Payment confirmed.',
};

function back(id: string, key: 'ok' | 'error', msg: string): never {
  redirect(`/bookings/${id}?${key}=${encodeURIComponent(msg)}`);
}

async function load(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect('/trips');
  const me = await getMe();
  if (!me) redirect(`/login?next=/bookings/${id}`);
  const admin = createAdminClient();
  const { data } = await admin.from('bookings').select(BOOKING_COLUMNS).eq('id', id).maybeSingle();
  const b = data as Booking | null;
  if (!b) redirect('/trips');
  const actor: Actor | null =
    b.host_id === me.id ? 'host' : b.guest_id === me.id ? 'guest' : me.profile.role === 'admin' ? 'admin' : null;
  if (!actor) redirect('/trips');
  return { me, admin, b, actor };
}

// Host/guest/admin status changes. Who may do what comes from
// allowedActions(); the database re-checks the transition and overlaps.
export async function changeBooking(form: FormData) {
  const id = String(form.get('booking_id') ?? '');
  const action = String(form.get('action') ?? '') as BookingAction;
  const { admin, b, actor } = await load(id);
  if (!ACTIONS.includes(action) || !allowedActions(b, actor, todayTT()).includes(action)) {
    back(id, 'error', 'That action isn’t available for this trip any more.');
  }
  const note = String(form.get('note') ?? '').trim().slice(0, 500) || null;

  if (action === 'approve') {
    const busy = await busyRangesAdmin(admin, b.car_id);
    if (busy.some((r) => overlaps(b, r))) back(id, 'error', 'Those dates are no longer free — decline this request instead.');
  }

  const who = actor === 'host' ? 'host' : actor === 'guest' ? 'guest' : 'IslandDrive';
  const { data: changed, error } = await admin
    .from('bookings')
    .update({
      status: targetStatus(action),
      status_note: action === 'cancel' || action === 'decline' ? (note ? `${who}: ${note}` : `By the ${who}`) : b.status_note,
    })
    .eq('id', id)
    .eq('status', b.status) // optimistic lock: nobody changed it meanwhile
    .select('id');
  if (error) {
    back(id, 'error', error.code === '23P01' ? 'Another trip was approved for those dates first.' : 'Could not update the trip — refresh and try again.');
  }
  if (!changed?.length) back(id, 'error', 'This trip changed while you were looking at it — here is the latest.');
  if (action === 'approve') {
    // Other pending requests that now clash can never be approved; decline them.
    await admin
      .from('bookings')
      .update({ status: 'declined', status_note: 'Dates were booked by another guest' })
      .eq('car_id', b.car_id)
      .eq('status', 'requested')
      .neq('id', id)
      .lt('start_date', b.end_date)
      .gt('end_date', b.start_date);
  }
  revalidatePath(`/bookings/${id}`);
  back(id, 'ok', OK[action]);
}

export async function submitProof(form: FormData) {
  const id = String(form.get('booking_id') ?? '');
  const { me, admin, b, actor } = await load(id);
  if (actor !== 'guest' || b.status !== 'approved') back(id, 'error', 'Payment can only be sent for an approved trip.');
  const { data: open } = await admin.from('payments').select('id').eq('booking_id', id).eq('status', 'submitted').limit(1);
  if (open?.length) back(id, 'error', 'We already have your payment proof and are checking it.');
  const reference = String(form.get('reference') ?? '').trim().slice(0, 120) || null;
  const up = checkUpload(form.get('proof'), `${me.id}/${id}`, { allowPdf: true });
  if (!up.ok) back(id, 'error', up.error);
  const { error: upErr } = await admin.storage.from('proofs').upload(up.path, up.file, { contentType: up.file.type });
  if (upErr) back(id, 'error', 'Upload failed — please try again.');
  const { error } = await admin.from('payments').insert({
    booking_id: id,
    payer_id: me.id,
    method: 'bank_transfer',
    amount_cents: b.total_cents, // the booking's frozen total, never a typed amount
    reference,
    proof_path: up.path,
  });
  if (error) {
    back(id, 'error', error.code === '23505' ? 'We already have your payment proof and are checking it.' : 'Could not record your payment — please try again.');
  }
  revalidatePath(`/bookings/${id}`);
  back(id, 'ok', 'Thanks! We’ll confirm your payment shortly.');
}
