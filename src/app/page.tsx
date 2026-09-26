import Link from 'next/link';
import { CarCard } from '@/components/CarCard';
import { SearchForm } from '@/components/SearchForm';
import { listAreas, searchCars } from '@/lib/data';
import { addDays, todayTT } from '@/lib/dates';

export default async function Home() {
  const [areas, cars] = await Promise.all([listAreas(), searchCars({ limit: 6 })]);
  const minDate = addDays(todayTT(), 1);
  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-sea-700 via-sea-600 to-sea-500 text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sun/30 blur-3xl" />
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-12 sm:px-6 sm:pt-20">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-white/80">Trinidad &amp; Tobago</p>
          <h1 className="max-w-2xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Skip the rental counter. Drive a local&apos;s car.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-white/85">
            From a hybrid in Port of Spain to a Hilux in San Fernando — booked in minutes, picked up where you are.
          </p>
        </div>
      </section>
      <div className="relative z-10 mx-auto -mt-14 max-w-5xl px-4 sm:px-6">
        <div className="card p-4 sm:p-5">
          <SearchForm areas={areas} minDate={minDate} />
        </div>
      </div>

      <section className="page">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="h1">Cars near you</h2>
          <Link href="/cars" className="text-sm font-semibold text-sea-700 hover:underline">See all →</Link>
        </div>
        {cars.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cars.map((c) => <CarCard key={c.id} car={c} areas={areas} />)}
          </div>
        ) : (
          <div className="card p-8 text-center">
            <p className="font-semibold">No cars listed yet.</p>
            <p className="muted mt-1">Be the first host on IslandDrive.</p>
            <Link href="/host" className="btn-primary mt-4">List your car</Link>
          </div>
        )}
      </section>

      <section className="page grid gap-5 md:grid-cols-3">
        {[
          ['1. Find a car', 'Search by area and dates. Every price is in TT dollars, fees shown up front.'],
          ['2. Request & pay', 'The host approves your request, then you pay by bank transfer. Your trip is confirmed once payment is received.'],
          ['3. Pick up & go', 'Chat with your host on WhatsApp, collect the keys, and return the car on the day you agreed.'],
        ].map(([t, d]) => (
          <div key={t} className="card p-5">
            <h3 className="font-bold">{t}</h3>
            <p className="muted mt-1.5">{d}</p>
          </div>
        ))}
      </section>

      <section className="page">
        <div className="card flex flex-col items-start gap-4 bg-ink p-8 text-white sm:flex-row sm:items-center">
          <div className="flex-1">
            <h2 className="text-2xl font-bold">Your car could be earning while it&apos;s parked.</h2>
            <p className="mt-1 text-white/75">List it free. You set the price and the dates; you approve every guest.</p>
          </div>
          <Link href="/host" className="btn bg-sun text-ink hover:brightness-95">Start hosting</Link>
        </div>
      </section>
    </>
  );
}
