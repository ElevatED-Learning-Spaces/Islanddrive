import type { Metadata } from 'next';
import Link from 'next/link';
import { Flash } from '@/components/Flash';
import { requireMe } from '@/lib/auth';
import { listAreas } from '@/lib/data';
import { createCar } from '../actions';
import { CarForm } from '../CarForm';

export const metadata: Metadata = { title: 'List a car' };

export default async function NewCarPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireMe('/host/cars/new');
  const [areas, sp] = await Promise.all([listAreas(), searchParams]);
  return (
    <div className="page max-w-3xl">
      <Link href="/host" className="text-sm text-sea-700 hover:underline">← Host dashboard</Link>
      <h1 className="h1 mb-6 mt-2">List your car</h1>
      <Flash error={sp.error} />
      <CarForm action={createCar} areas={areas} submitText="Save and add photos" />
    </div>
  );
}
