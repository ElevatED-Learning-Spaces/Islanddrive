import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CarImage } from '@/components/CarImage';
import { getMe } from '@/lib/auth';
import { carTitle, getCar, listAreas } from '@/lib/data';
import { addDays, prettyDate, todayTT } from '@/lib/dates';
import { supabaseConfigured } from '@/lib/env';
import { labelFor } from '@/lib/labels';
import { BookingPanel } from './BookingPanel';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ start?: string; end?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await getCar((await params).id);
  return { title: d ? carTitle(d.car) : 'Car not found' };
}

export default async function CarPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const [detail, areas, me] = await Promise.all([getCar(id), listAreas(), getMe()]);
  if (!detail) notFound();
  const { car, photos, busy, host } = detail;
  const area = areas.find((a) => a.slug === car.area)?.name ?? '';
  const today = todayTT();

  let blocker: { text: string; href?: string; cta?: string } | null = null;
  if (!supabaseConfigured()) blocker = { text: 'Demo mode — booking is switched off.' };
  else if (car.status !== 'listed') blocker = { text: 'This car isn’t listed right now.' };
  else if (!me) blocker = { text: 'Sign in to request this car.', href: `/login?next=/cars/${car.id}`, cta: 'Sign in' };
  else if (me.id === car.host_id) blocker = { text: 'This is your car.', href: `/host/cars/${car.id}`, cta: 'Edit listing' };
  else if (me.profile.permit_status !== 'approved')
    blocker = {
      text: me.profile.permit_status === 'pending' ? 'Your driver’s permit is being checked — you can book once it’s verified.' : 'Verify your driver’s permit to book.',
      href: '/account', cta: 'Go to account',
    };
  else if (!me.profile.phone || !me.profile.full_name) blocker = { text: 'Add your name and WhatsApp number first.', href: '/account', cta: 'Go to account' };

  const upcomingBusy = busy.filter((b) => b.end_date > today).slice(0, 6);

  return (
    <div className="page">
      <div className={`grid gap-3 overflow-hidden rounded-[var(--radius-card)] ${photos.length > 1 ? 'sm:grid-cols-[2fr_1fr]' : ''}`}>
        <div className={`aspect-[16/10] overflow-hidden rounded-[var(--radius-card)] bg-white sm:rounded-none ${photos.length > 1 ? '' : 'sm:aspect-[21/8]'}`}>
          <CarImage src={photos[0] ?? null} alt={carTitle(car)} />
        </div>
        {photos.length > 1 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
            {photos.slice(1, 3).map((p) => (
              <div key={p} className="aspect-[16/10] overflow-hidden sm:aspect-auto"><CarImage src={p} alt={carTitle(car)} /></div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <div>
            <h1 className="h1">{carTitle(car)}</h1>
            <p className="muted mt-1">{area}{car.delivery_available ? ' · Delivery available' : ''}</p>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Seats', String(car.seats)],
              ['Gearbox', labelFor('transmission', car.transmission).label],
              ['Fuel', labelFor('fuel', car.fuel).label],
              ['Trip length', car.min_days === 1 ? `Up to ${car.max_days} days` : `${car.min_days}–${car.max_days} days`],
            ].map(([k, v]) => (
              <li key={k} className="card p-3">
                <div className="text-xs text-ink-soft">{k}</div>
                <div className="font-semibold">{v}</div>
              </li>
            ))}
          </ul>
          {car.description ? (
            <section>
              <h2 className="h2 mb-2">About this car</h2>
              <p className="whitespace-pre-line leading-relaxed text-ink/90">{car.description}</p>
            </section>
          ) : null}
          {car.pickup_notes ? (
            <section>
              <h2 className="h2 mb-2">Pickup</h2>
              <p className="whitespace-pre-line text-ink/90">{car.pickup_notes}</p>
            </section>
          ) : null}
          {host ? (
            <section className="card flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sea-100 text-lg font-bold text-sea-700">{host.first_name[0]}</div>
              <div>
                <div className="font-semibold">Hosted by {host.first_name}</div>
                <div className="muted">
                  {host.trips} trip{host.trips === 1 ? '' : 's'} · on IslandDrive since {new Date(host.member_since).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                </div>
              </div>
            </section>
          ) : null}
          {upcomingBusy.length ? (
            <section>
              <h2 className="h2 mb-2">Already booked</h2>
              <ul className="space-y-1 text-sm text-ink-soft">
                {upcomingBusy.map((b) => (
                  <li key={b.start_date + b.end_date}>{prettyDate(b.start_date)} – {prettyDate(addDays(b.end_date, -1))}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
        <div className="lg:sticky lg:top-20 lg:self-start">
          <BookingPanel
            carId={car.id}
            car={car}
            busy={busy}
            today={today}
            initial={{ start: sp.start, end: sp.end }}
            blocker={blocker}
          />
        </div>
      </div>
    </div>
  );
}
