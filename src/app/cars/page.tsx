import type { Metadata } from 'next';
import { CarCard } from '@/components/CarCard';
import { SearchForm } from '@/components/SearchForm';
import { listAreas, searchCars } from '@/lib/data';
import { addDays, isIsoDate, prettyRange, todayTT } from '@/lib/dates';

export const metadata: Metadata = { title: 'Find a car' };

type Params = { area?: string; start?: string; end?: string; seats?: string; transmission?: string };

export default async function CarsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const areas = await listAreas();
  const area = areas.some((a) => a.slug === sp.area) ? sp.area : undefined;
  const today = todayTT();
  const datesOk = isIsoDate(sp.start) && isIsoDate(sp.end) && sp.start > today && sp.end > sp.start;
  const start = datesOk ? sp.start : undefined;
  const end = datesOk ? sp.end : undefined;

  let cars = await searchCars({ area, start, end });
  const seats = Number(sp.seats) || 0;
  if (seats) cars = cars.filter((c) => c.seats >= seats);
  if (sp.transmission === 'automatic' || sp.transmission === 'manual') cars = cars.filter((c) => c.transmission === sp.transmission);

  const qs = new URLSearchParams();
  if (start && end) { qs.set('start', start); qs.set('end', end); }
  const areaName = areas.find((a) => a.slug === area)?.name;

  return (
    <div className="page">
      <div className="card mb-6 p-4">
        <SearchForm areas={areas} values={{ area, start, end }} minDate={addDays(today, 1)} compact />
        <form action="/cars" method="get" className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-sm">
          {area ? <input type="hidden" name="area" value={area} /> : null}
          {start ? <input type="hidden" name="start" value={start} /> : null}
          {end ? <input type="hidden" name="end" value={end} /> : null}
          <select name="seats" defaultValue={sp.seats ?? ''} className="input !w-auto !py-1.5">
            <option value="">Any seats</option>
            <option value="5">5+ seats</option>
            <option value="7">7+ seats</option>
          </select>
          <select name="transmission" defaultValue={sp.transmission ?? ''} className="input !w-auto !py-1.5">
            <option value="">Any transmission</option>
            <option value="automatic">Automatic</option>
            <option value="manual">Manual</option>
          </select>
          <button className="btn-ghost !py-1.5">Filter</button>
        </form>
      </div>
      <h1 className="h1">
        {cars.length} car{cars.length === 1 ? '' : 's'} {areaName ? `in ${areaName}` : 'across T&T'}
      </h1>
      {start && end ? <p className="muted mt-1">Free for {prettyRange(start, end)}</p> : null}
      {sp.start && !datesOk ? <p className="mt-1 text-sm text-coral">Those dates didn&apos;t work — pickup must be from tomorrow and before the return date.</p> : null}
      {cars.length ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cars.map((c) => <CarCard key={c.id} car={c} areas={areas} query={qs.toString()} />)}
        </div>
      ) : (
        <div className="card mt-6 p-8 text-center">
          <p className="font-semibold">No cars match that search.</p>
          <p className="muted mt-1">Try other dates or a nearby area.</p>
        </div>
      )}
    </div>
  );
}
