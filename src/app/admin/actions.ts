'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

function to(key: 'ok' | 'error', msg: string): never {
  redirect(`/admin?${key}=${encodeURIComponent(msg)}`);
}

// Every admin action re-checks the role: the service role bypasses RLS.
async function guard() {
  const me = await getMe();
  if (!me || me.profile.role !== 'admin') redirect('/');
  return { me, admin: createAdminClient() };
}

const note = (f: FormData) => String(f.get('note') ?? '').trim().slice(0, 500);

export async function reviewCar(form: FormData) {
  const { admin } = await guard();
  const id = String(form.get('id') ?? '');
  const approve = form.get('decision') === 'approve';
  const n = note(form);
  if (!approve && !n) to('error', 'Say what the host needs to change.');
  const { data } = await admin
    .from('cars')
    .update({ status: approve ? 'listed' : 'rejected', review_note: approve ? null : n })
    .eq('id', id)
    .eq('status', 'pending_review')
    .select('id');
  if (!data?.length) to('error', 'That car is no longer waiting for review.');
  revalidatePath('/admin');
  to('ok', approve ? 'Car listed.' : 'Sent back to the host.');
}

export async function reviewPermit(form: FormData) {
  const { admin } = await guard();
  const id = String(form.get('id') ?? '');
  const approve = form.get('decision') === 'approve';
  const n = note(form);
  if (!approve && !n) to('error', 'Say why the permit was not accepted.');
  const { data } = await admin
    .from('profiles')
    .update({ permit_status: approve ? 'approved' : 'rejected', permit_note: approve ? null : n })
    .eq('id', id)
    .eq('permit_status', 'pending')
    .select('id');
  if (!data?.length) to('error', 'That permit is no longer waiting for review.');
  revalidatePath('/admin');
  to('ok', approve ? 'Driver verified.' : 'Permit rejected — the member has been asked for a new one.');
}

export async function reviewPayment(form: FormData) {
  const { me, admin } = await guard();
  const id = String(form.get('id') ?? '');
  const approve = form.get('decision') === 'approve';
  const n = note(form);
  const { data: p } = await admin.from('payments').select('id, booking_id, status, amount_cents').eq('id', id).maybeSingle();
  if (!p || p.status !== 'submitted') to('error', 'That payment is no longer waiting.');
  if (!approve) {
    if (!n) to('error', 'Say why the payment was not accepted.');
    await admin.from('payments').update({ status: 'rejected', review_note: n, reviewed_by: me.id, reviewed_at: new Date().toISOString() }).eq('id', id).eq('status', 'submitted');
    revalidatePath('/admin');
    to('ok', 'Payment rejected — the guest can upload a new receipt.');
  }
  const { data: b } = await admin.from('bookings').select('id, status, total_cents').eq('id', p.booking_id).single();
  if (!b || b.status !== 'approved') to('error', 'This trip is no longer awaiting payment (it may have expired or been cancelled) — refund the guest by hand.');
  if (b.total_cents !== p.amount_cents) to('error', 'Payment amount doesn’t match the trip total.');
  const { data: upd, error } = await admin.from('bookings').update({ status: 'paid' }).eq('id', b.id).eq('status', 'approved').select('id');
  if (error || !upd?.length) to('error', 'Could not confirm the trip — refresh and try again.');
  await admin.from('payments').update({ status: 'confirmed', review_note: n || null, reviewed_by: me.id, reviewed_at: new Date().toISOString() }).eq('id', id);
  revalidatePath('/admin');
  to('ok', 'Payment confirmed — the trip is booked.');
}

export async function recordPayout(form: FormData) {
  const { me, admin } = await guard();
  const bookingId = String(form.get('booking_id') ?? '');
  const reference = String(form.get('reference') ?? '').trim().slice(0, 120) || null;
  const { data: b } = await admin.from('bookings').select('id, host_id, status, host_payout_cents').eq('id', bookingId).maybeSingle();
  if (!b || b.status !== 'completed') to('error', 'Only completed trips can be paid out.');
  const { error } = await admin.from('host_payouts').insert({
    booking_id: b.id,
    host_id: b.host_id,
    amount_cents: b.host_payout_cents, // from the frozen booking, not the form
    reference,
    recorded_by: me.id,
  });
  if (error) to('error', error.code === '23505' ? 'That payout was already recorded.' : 'Could not record the payout.');
  revalidatePath('/admin');
  to('ok', 'Payout recorded.');
}
