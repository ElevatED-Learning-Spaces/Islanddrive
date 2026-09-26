'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { isIsoDate, todayTT } from '@/lib/dates';
import { parseTtd } from '@/lib/money';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { checkUpload } from '@/lib/uploads';

const MAX_PHOTOS = 12;

function to(path: string, key: 'ok' | 'error', msg: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(msg)}`);
}

type CarInput = Record<string, string | number | boolean | null>;

// Reads and validates the listing form. Returns the columns or an error.
function readCar(form: FormData): { ok: true; car: CarInput } | { ok: false; error: string } {
  const s = (k: string) => String(form.get(k) ?? '').trim();
  const int = (k: string) => (/^\d+$/.test(s(k)) ? Number(s(k)) : NaN);
  const make = s('make');
  const model = s('model');
  const year = int('year');
  const seats = int('seats');
  const daily = parseTtd(s('daily_rate'));
  const cleaning = s('cleaning_fee') ? parseTtd(s('cleaning_fee')) : 0;
  const deposit = s('deposit') ? parseTtd(s('deposit')) : 0;
  const discount = s('weekly_discount_pct') ? int('weekly_discount_pct') : 0;
  const minDays = int('min_days');
  const maxDays = int('max_days');
  const thisYear = Number(todayTT().slice(0, 4));

  if (!make || make.length > 40 || !model || model.length > 60) return { ok: false, error: 'Enter the make and model.' };
  if (!(year >= 1980 && year <= thisYear + 1)) return { ok: false, error: 'Enter a valid year.' };
  if (!(seats >= 1 && seats <= 15)) return { ok: false, error: 'Seats must be between 1 and 15.' };
  if (daily === null || daily < 5000) return { ok: false, error: 'Daily price must be at least TT$50.' };
  if (daily > 10_000_000) return { ok: false, error: 'Daily price is too high.' };
  if (cleaning === null || cleaning > 1_000_000) return { ok: false, error: 'Check the cleaning fee.' };
  if (deposit === null || deposit > 5_000_000) return { ok: false, error: 'Check the deposit.' };
  if (!(discount >= 0 && discount <= 50)) return { ok: false, error: 'Weekly discount must be 0–50%.' };
  if (!(minDays >= 1 && minDays <= 30) || !(maxDays >= minDays && maxDays <= 90)) {
    return { ok: false, error: 'Trip length: minimum 1–30 days, maximum up to 90 and not below the minimum.' };
  }
  const transmission = s('transmission');
  const fuel = s('fuel');
  if (!['automatic', 'manual'].includes(transmission)) return { ok: false, error: 'Choose a gearbox.' };
  if (!['gasoline', 'diesel', 'hybrid', 'electric'].includes(fuel)) return { ok: false, error: 'Choose a fuel type.' };
  const area = s('area');
  if (!/^[a-z0-9-]+$/.test(area)) return { ok: false, error: 'Choose where the car is picked up.' };

  return {
    ok: true,
    car: {
      make, model, year, seats, transmission, fuel, area,
      daily_rate_cents: daily,
      cleaning_fee_cents: cleaning,
      deposit_cents: deposit,
      weekly_discount_pct: discount,
      min_days: minDays,
      max_days: maxDays,
      delivery_available: form.get('delivery_available') === 'on',
      description: s('description').slice(0, 3000) || null,
      pickup_notes: s('pickup_notes').slice(0, 500) || null,
    },
  };
}

// Car writes use the member's own client: RLS scopes them to their cars and
// the cars_guard trigger stops a host listing their own car.
export async function createCar(form: FormData) {
  const me = await getMe();
  if (!me) redirect('/login?next=/host/cars/new');
  const r = readCar(form);
  if (!r.ok) to('/host/cars/new', 'error', r.error);
  const supabase = await createClient();
  const { data, error } = await supabase.from('cars').insert({ ...r.car, host_id: me.id }).select('id').single();
  if (error || !data) to('/host/cars/new', 'error', 'Could not save the car. Check the details and try again.');
  redirect(`/host/cars/${data.id}?ok=${encodeURIComponent('Saved as a draft. Add photos, then submit it for review.')}`);
}

export async function updateCar(form: FormData) {
  const me = await getMe();
  const id = String(form.get('car_id') ?? '');
  const path = `/host/cars/${id}`;
  if (!me) redirect(`/login?next=${path}`);
  const r = readCar(form);
  if (!r.ok) to(path, 'error', r.error);
  const supabase = await createClient();
  const { data, error } = await supabase.from('cars').update(r.car).eq('id', id).eq('host_id', me.id).select('id');
  if (error || !data?.length) to(path, 'error', 'Could not save changes.');
  revalidatePath(path);
  to(path, 'ok', 'Changes saved.');
}

export async function setCarStatus(form: FormData) {
  const me = await getMe();
  const id = String(form.get('car_id') ?? '');
  const next = String(form.get('status') ?? '');
  const path = `/host/cars/${id}`;
  if (!me) redirect(`/login?next=${path}`);
  if (!['pending_review', 'draft', 'paused', 'listed'].includes(next)) to(path, 'error', 'Unknown change.');
  const supabase = await createClient();
  if (next === 'pending_review') {
    const [{ count }, { data: car }] = await Promise.all([
      supabase.from('car_photos').select('id', { count: 'exact', head: true }).eq('car_id', id),
      supabase.from('cars').select('description').eq('id', id).eq('host_id', me.id).maybeSingle(),
    ]);
    if (!count || count < 3) to(path, 'error', 'Add at least 3 photos before submitting.');
    if (!car?.description || car.description.length < 40) to(path, 'error', 'Add a short description (40+ characters) before submitting.');
    if (!me.profile.phone) to(path, 'error', 'Add your WhatsApp number on your Account page first.');
  }
  const { data, error } = await supabase.from('cars').update({ status: next }).eq('id', id).eq('host_id', me.id).select('id');
  if (error || !data?.length) to(path, 'error', 'That change isn’t allowed right now.');
  revalidatePath(path);
  revalidatePath('/host');
  const msg: Record<string, string> = {
    pending_review: 'Submitted! We review new listings within a day.',
    draft: 'Moved back to draft.',
    paused: 'Listing paused — it’s hidden from search.',
    listed: 'Listing is live again.',
  };
  to(path, 'ok', msg[next]);
}

// Ownership check with the member's client, then the service role for storage.
async function ownCar(id: string) {
  const me = await getMe();
  if (!me) redirect(`/login?next=/host/cars/${id}`);
  const supabase = await createClient();
  const { data } = await supabase.from('cars').select('id').eq('id', id).eq('host_id', me.id).maybeSingle();
  if (!data) redirect('/host');
  return me;
}

export async function uploadPhotos(form: FormData) {
  const id = String(form.get('car_id') ?? '');
  const path = `/host/cars/${id}`;
  await ownCar(id);
  const files = form.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) to(path, 'error', 'Choose at least one photo.');
  const admin = createAdminClient();
  const { data: existing } = await admin.from('car_photos').select('position').eq('car_id', id).order('position', { ascending: false });
  const have = existing?.length ?? 0;
  if (have + files.length > MAX_PHOTOS) to(path, 'error', `Up to ${MAX_PHOTOS} photos per car.`);
  let pos = (existing?.[0]?.position ?? -1) + 1;
  for (const f of files) {
    const up = checkUpload(f, id);
    if (!up.ok) to(path, 'error', `${f.name}: ${up.error}`);
    const { error } = await admin.storage.from('car-photos').upload(up.path, up.file, { contentType: up.file.type });
    if (error) to(path, 'error', 'Upload failed — please try again.');
    await admin.from('car_photos').insert({ car_id: id, path: up.path, position: pos++ });
  }
  revalidatePath(path);
  to(path, 'ok', `${files.length} photo${files.length === 1 ? '' : 's'} added.`);
}

export async function deletePhoto(form: FormData) {
  const id = String(form.get('car_id') ?? '');
  const photoId = String(form.get('photo_id') ?? '');
  const path = `/host/cars/${id}`;
  await ownCar(id);
  const admin = createAdminClient();
  const { data } = await admin.from('car_photos').delete().eq('id', photoId).eq('car_id', id).select('path');
  if (data?.[0]) await admin.storage.from('car-photos').remove([data[0].path]);
  revalidatePath(path);
  to(path, 'ok', 'Photo removed.');
}

export async function makeCover(form: FormData) {
  const id = String(form.get('car_id') ?? '');
  const photoId = String(form.get('photo_id') ?? '');
  const path = `/host/cars/${id}`;
  await ownCar(id);
  const admin = createAdminClient();
  const { data: min } = await admin.from('car_photos').select('position').eq('car_id', id).order('position').limit(1);
  await admin.from('car_photos').update({ position: (min?.[0]?.position ?? 0) - 1 }).eq('id', photoId).eq('car_id', id);
  revalidatePath(path);
  to(path, 'ok', 'Cover photo updated.');
}

export async function addBlock(form: FormData) {
  const id = String(form.get('car_id') ?? '');
  const path = `/host/cars/${id}`;
  await ownCar(id);
  const start = String(form.get('start') ?? '');
  const end = String(form.get('end') ?? '') || start;
  if (!isIsoDate(start) || !isIsoDate(end) || end < start) to(path, 'error', 'Choose a valid date range.');
  if (end < todayTT()) to(path, 'error', 'Those dates are in the past.');
  const admin = createAdminClient();
  const { data: clash } = await admin
    .from('bookings')
    .select('id')
    .eq('car_id', id)
    .in('status', ['approved', 'paid', 'active'])
    .lte('start_date', end)
    .gt('end_date', start)
    .limit(1);
  if (clash?.length) to(path, 'error', 'A confirmed trip already uses some of those dates.');
  await admin.from('car_blocks').insert({ car_id: id, start_date: start, end_date: end, note: String(form.get('note') ?? '').slice(0, 200) || null });
  revalidatePath(path);
  to(path, 'ok', 'Dates blocked.');
}

export async function deleteBlock(form: FormData) {
  const id = String(form.get('car_id') ?? '');
  const path = `/host/cars/${id}`;
  await ownCar(id);
  const admin = createAdminClient();
  await admin.from('car_blocks').delete().eq('id', String(form.get('block_id') ?? '')).eq('car_id', id);
  revalidatePath(path);
  to(path, 'ok', 'Dates unblocked.');
}
