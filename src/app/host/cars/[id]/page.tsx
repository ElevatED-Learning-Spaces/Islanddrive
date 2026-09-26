/* eslint-disable @next/next/no-img-element -- Supabase public URLs */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Flash } from '@/components/Flash';
import { StatusChip } from '@/components/StatusChip';
import { SubmitButton } from '@/components/SubmitButton';
import { requireMe } from '@/lib/auth';
import { carTitle, listAreas, photoUrl } from '@/lib/data';
import { prettyDate, todayTT } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import { CAR_COLUMNS, type Car } from '@/lib/types';
import { addBlock, deleteBlock, deletePhoto, makeCover, setCarStatus, updateCar, uploadPhotos } from '../actions';
import { CarForm } from '../CarForm';

export const metadata: Metadata = { title: 'Edit listing' };

export default async function EditCarPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const me = await requireMe(`/host/cars/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from('cars').select(CAR_COLUMNS).eq('id', id).eq('host_id', me.id).maybeSingle();
  const car = data as Car | null;
  if (!car) notFound();
  const today = todayTT();
  const [areas, { data: photos }, { data: blocks }] = await Promise.all([
    listAreas(),
    supabase.from('car_photos').select('id, path, position').eq('car_id', id).order('position'),
    supabase.from('car_blocks').select('id, start_date, end_date, note').eq('car_id', id).gte('end_date', today).order('start_date'),
  ]);

  const statusButtons: { to: string; text: string; cls: string }[] = [];
  if (car.status === 'draft' || car.status === 'rejected') statusButtons.push({ to: 'pending_review', text: 'Submit for review', cls: 'btn-primary' });
  if (car.status === 'pending_review') statusButtons.push({ to: 'draft', text: 'Withdraw from review', cls: 'btn-ghost' });
  if (car.status === 'listed') statusButtons.push({ to: 'paused', text: 'Pause listing', cls: 'btn-ghost' });
  if (car.status === 'paused') statusButtons.push({ to: 'listed', text: 'Relist', cls: 'btn-primary' });

  return (
    <div className="page max-w-3xl space-y-6">
      <div>
        <Link href="/host" className="text-sm text-sea-700 hover:underline">← Host dashboard</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="h1 mr-auto">{carTitle(car)}</h1>
          <StatusChip kind="car" code={car.status} />
          {car.status === 'listed' ? <Link href={`/cars/${car.id}`} className="text-sm font-semibold text-sea-700 hover:underline">View listing</Link> : null}
        </div>
      </div>
      <Flash ok={sp.ok} error={sp.error} />
      {car.status === 'rejected' && car.review_note ? <p className="notice border-red-200 bg-red-50 text-red-800">Reviewer: {car.review_note}</p> : null}

      {statusButtons.length ? (
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <p className="muted mr-auto">
            {car.status === 'draft' || car.status === 'rejected' ? 'Needs 3+ photos and a description to submit.' : car.status === 'pending_review' ? 'We’re reviewing your car.' : car.status === 'listed' ? 'Your car is live in search.' : 'Hidden from search.'}
          </p>
          {statusButtons.map((b) => (
            <form key={b.to} action={setCarStatus}>
              <input type="hidden" name="car_id" value={car.id} />
              <input type="hidden" name="status" value={b.to} />
              <SubmitButton className={b.cls}>{b.text}</SubmitButton>
            </form>
          ))}
        </div>
      ) : null}

      <section className="card space-y-4 p-5">
        <h2 className="h2">Photos</h2>
        {photos?.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p, i) => (
              <li key={p.id} className="overflow-hidden rounded-xl border border-line">
                <img src={photoUrl(p.path)} alt="" className="aspect-[4/3] w-full object-cover" />
                <div className="flex items-center justify-between gap-1 p-2 text-xs">
                  {i === 0 ? <span className="chip bg-sea-50 text-sea-700">Cover</span> : (
                    <form action={makeCover}><input type="hidden" name="car_id" value={car.id} /><input type="hidden" name="photo_id" value={p.id} /><button className="text-sea-700 hover:underline">Make cover</button></form>
                  )}
                  <form action={deletePhoto}><input type="hidden" name="car_id" value={car.id} /><input type="hidden" name="photo_id" value={p.id} /><SubmitButton className="text-coral hover:underline" confirm="Remove this photo?">Remove</SubmitButton></form>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="muted">No photos yet. Front, back, side and interior work best.</p>}
        <form action={uploadPhotos} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="car_id" value={car.id} />
          <input name="photos" type="file" multiple accept="image/jpeg,image/png,image/webp" required className="min-w-0 flex-1 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-sea-50 file:px-4 file:py-2 file:font-semibold file:text-sea-700" />
          <SubmitButton pendingText="Uploading…">Upload</SubmitButton>
        </form>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="h2">Blocked dates</h2>
        {blocks?.length ? (
          <ul className="divide-y divide-line text-sm">
            {blocks.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2">
                <span>{prettyDate(b.start_date)}{b.end_date !== b.start_date ? ` – ${prettyDate(b.end_date)}` : ''}{b.note ? ` · ${b.note}` : ''}</span>
                <form action={deleteBlock}><input type="hidden" name="car_id" value={car.id} /><input type="hidden" name="block_id" value={b.id} /><button className="text-coral hover:underline">Unblock</button></form>
              </li>
            ))}
          </ul>
        ) : <p className="muted">No blocked dates. Block days you need the car yourself.</p>}
        <form action={addBlock} className="grid gap-3 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
          <input type="hidden" name="car_id" value={car.id} />
          <div><label className="label" htmlFor="bs">From</label><input id="bs" name="start" type="date" min={today} required className="input" /></div>
          <div><label className="label" htmlFor="be">To (inclusive)</label><input id="be" name="end" type="date" min={today} className="input" /></div>
          <div><label className="label" htmlFor="bn">Note</label><input id="bn" name="note" maxLength={200} className="input" placeholder="Carnival — using it myself" /></div>
          <SubmitButton className="btn-ghost">Block</SubmitButton>
        </form>
      </section>

      <div>
        <h2 className="h2 mb-3">Details &amp; price</h2>
        {car.status === 'listed' || car.status === 'paused' ? (
          <p className="muted -mt-1 mb-3">Price, fees and trip length update straight away. Changing the car itself, its area, description or photos sends it back to review first.</p>
        ) : null}
        <CarForm action={updateCar} areas={areas} car={car} submitText="Save changes" />
      </div>
    </div>
  );
}
