'use server';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { tripProblem } from '@/lib/availability';
import { busyRangesAdmin } from '@/lib/data';
import { daysBetween, todayTT } from '@/lib/dates';
import { supabaseConfigured } from '@/lib/env';
import { quoteTrip } from '@/lib/pricing';
import { createAdminClient } from '@/lib/supabase/admin';
import { CAR_COLUMNS, type Car } from '@/lib/types';

export type RequestState = { error: string | null };

// Guest asks to book a car. Price comes from the car row in the database,
// never from the form; the service role writes the booking after these checks.
export async function requestBooking(_prev: RequestState, form: FormData): Promise<RequestState> {
  if (!supabaseConfigured()) return { error: 'Bookings are off in demo mode.' };
  const me = await getMe();
  if (!me) return { error: 'Sign in to request this car.' };
  if (me.profile.permit_status !== 'approved') {
    return { error: 'Your driver’s permit must be verified before you can book. Upload it on your Account page.' };
  }
  if (!me.profile.phone || !me.profile.full_name) {
    return { error: 'Add your name and WhatsApp number on your Account page so your host can reach you.' };
  }

  const carId = String(form.get('car_id') ?? '');
  const start = form.get('start');
  const end = form.get('end');
  const message = String(form.get('message') ?? '').trim().slice(0, 1000) || null;
  if (!/^[0-9a-f-]{36}$/i.test(carId)) return { error: 'That car could not be found.' };

  const admin = createAdminClient();
  const { data: carRow } = await admin.from('cars').select(CAR_COLUMNS).eq('id', carId).maybeSingle();
  const car = carRow as Car | null;
  if (!car || car.status !== 'listed') return { error: 'This car is not available to book right now.' };
  if (car.host_id === me.id) return { error: 'You can’t book your own car.' };

  const busy = await busyRangesAdmin(admin, car.id);
  const problem = tripProblem({ start, end, today: todayTT(), minDays: car.min_days, maxDays: car.max_days, busy });
  if (problem) return { error: problem };
  const s = start as string;
  const e = end as string;

  const { data: dup } = await admin
    .from('bookings')
    .select('id')
    .eq('car_id', car.id)
    .eq('guest_id', me.id)
    .in('status', ['requested', 'approved'])
    .lt('start_date', e)
    .gt('end_date', s)
    .limit(1);
  if (dup?.length) return { error: 'You already have a request for this car on those dates.' };

  const q = quoteTrip(car, daysBetween(s, e));
  const { data: booking, error } = await admin
    .from('bookings')
    .insert({
      car_id: car.id,
      guest_id: me.id,
      host_id: car.host_id,
      start_date: s,
      end_date: e,
      ...q,
      guest_message: message,
    })
    .select('id')
    .single();
  if (error || !booking) return { error: 'Something went wrong sending your request. Please try again.' };
  redirect(`/bookings/${booking.id}?ok=${encodeURIComponent('Request sent — your host will reply soon.')}`);
}
