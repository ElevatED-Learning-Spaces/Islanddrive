import Link from 'next/link';
import { carTitle } from '@/lib/data';
import { labelFor } from '@/lib/labels';
import { ttd } from '@/lib/money';
import type { Area, CarCard as Card } from '@/lib/types';
import { CarImage } from './CarImage';

export function CarCard({ car, areas, query }: { car: Card; areas: Area[]; query?: string }) {
  const area = areas.find((a) => a.slug === car.area)?.name ?? '';
  return (
    <Link href={`/cars/${car.id}${query ? `?${query}` : ''}`} className="card group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="aspect-[16/10] overflow-hidden">
        <CarImage src={car.photo} alt={carTitle(car)} className="transition duration-300 group-hover:scale-[1.03]" />
      </div>
      <div className="space-y-1 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold leading-tight">{carTitle(car)}</h3>
          <div className="shrink-0 text-right">
            <div className="font-bold">{ttd(car.daily_rate_cents, { whole: true })}</div>
            <div className="text-xs text-ink-soft">per day</div>
          </div>
        </div>
        <p className="muted">
          {area} · {labelFor('transmission', car.transmission).label} · {car.seats} seats
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {car.fuel === 'hybrid' || car.fuel === 'electric' ? (
            <span className="chip bg-sea-50 text-sea-700">{labelFor('fuel', car.fuel).label}</span>
          ) : null}
          {car.delivery_available ? <span className="chip bg-amber-50 text-amber-800">Delivery</span> : null}
          {car.weekly_discount_pct > 0 ? (
            <span className="chip bg-stone-100 text-stone-700">{car.weekly_discount_pct}% off weekly</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
