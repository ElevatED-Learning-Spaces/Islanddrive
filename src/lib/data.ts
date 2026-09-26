// Public catalogue reads. Uses the user's RLS client (anon or member), so only
// listed cars come back; falls back to the demo catalogue without Supabase.
import 'server-only';
import { blockToRange, type Range } from './availability';
import { DEMO_AREAS, DEMO_CARS } from './demo';
import { supabaseConfigured } from './env';
import { createClient } from './supabase/server';
import { CAR_COLUMNS, type Area, type Car, type CarCard, type CarPhoto } from './types';

export function photoUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/car-photos/${path}`;
}

export async function listAreas(): Promise<Area[]> {
  if (!supabaseConfigured()) return DEMO_AREAS;
  const supabase = await createClient();
  const { data } = await supabase.from('areas').select('slug, name, island').order('position');
  return (data ?? []) as Area[];
}

export async function searchCars(q: { area?: string; start?: string; end?: string; limit?: number }): Promise<CarCard[]> {
  if (!supabaseConfigured()) {
    return DEMO_CARS.filter((c) => !q.area || c.area === q.area)
      .slice(0, q.limit ?? 60)
      .map((c) => ({ ...c, photo: null }));
  }
  const supabase = await createClient();
  let query = supabase.from('cars').select(CAR_COLUMNS).eq('status', 'listed').order('created_at', { ascending: false }).limit(q.limit ?? 60);
  if (q.area) query = query.eq('area', q.area);
  if (q.start && q.end) {
    const { data: ids } = await supabase.rpc('available_car_ids', { p_start: q.start, p_end: q.end });
    const free = ((ids ?? []) as string[]).filter(Boolean);
    if (!free.length) return [];
    query = query.in('id', free);
  }
  const { data: cars } = await query;
  const list = (cars ?? []) as Car[];
  if (!list.length) return [];
  const { data: photos } = await supabase
    .from('car_photos')
    .select('car_id, path, position')
    .in('car_id', list.map((c) => c.id))
    .order('position');
  const first = new Map<string, string>();
  for (const p of (photos ?? []) as CarPhoto[]) if (!first.has(p.car_id)) first.set(p.car_id, photoUrl(p.path));
  return list.map((c) => ({ ...c, photo: first.get(c.id) ?? null }));
}

export type CarDetail = {
  car: Car;
  photos: string[];
  busy: Range[];
  host: { first_name: string; member_since: string; trips: number } | null;
};

export async function getCar(id: string): Promise<CarDetail | null> {
  if (!supabaseConfigured()) {
    const car = DEMO_CARS.find((c) => c.id === id);
    return car ? { car, photos: [], busy: [], host: { first_name: 'Demo', member_since: '2026-09-01', trips: 0 } } : null;
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data: car } = await supabase.from('cars').select(CAR_COLUMNS).eq('id', id).maybeSingle();
  if (!car) return null;
  const [{ data: photos }, { data: busy }, { data: host }] = await Promise.all([
    supabase.from('car_photos').select('path, position').eq('car_id', id).order('position'),
    supabase.rpc('car_busy_ranges', { p_car: id }),
    supabase.rpc('host_public', { p_host: (car as Car).host_id }),
  ]);
  return {
    car: car as Car,
    photos: ((photos ?? []) as { path: string }[]).map((p) => photoUrl(p.path)),
    busy: (busy ?? []) as Range[],
    host: ((host ?? []) as CarDetail['host'][])[0] ?? null,
  };
}

// Busy ranges for a car as the server sees them (service role, any status):
// holding bookings + host blocks, half-open. Used when validating a request.
export async function busyRangesAdmin(
  admin: ReturnType<typeof import('./supabase/admin').createAdminClient>,
  carId: string,
): Promise<Range[]> {
  const [{ data: bookings }, { data: blocks }] = await Promise.all([
    admin.from('bookings').select('start_date, end_date').eq('car_id', carId).in('status', ['approved', 'paid', 'active', 'completed']),
    admin.from('car_blocks').select('start_date, end_date').eq('car_id', carId),
  ]);
  return [...((bookings ?? []) as Range[]), ...((blocks ?? []) as Range[]).map(blockToRange)];
}

export function carTitle(c: Pick<Car, 'make' | 'model' | 'year'>): string {
  return `${c.make} ${c.model} ${c.year}`;
}
