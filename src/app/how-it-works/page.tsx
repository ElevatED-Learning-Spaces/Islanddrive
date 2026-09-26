import type { Metadata } from 'next';
import Link from 'next/link';
import { HOST_FEE_PCT, SERVICE_FEE_PCT } from '@/lib/pricing';

export const metadata: Metadata = { title: 'How it works' };

export default function HowItWorks() {
  const sections: [string, string[]][] = [
    ['For guests', [
      'Sign in with your email and add your WhatsApp number.',
      'Upload your driver’s permit once — we verify it before your first trip.',
      'Request a car for your dates. You pay nothing until the host approves.',
      `Pay the trip total by bank transfer and upload the receipt. The total includes a ${SERVICE_FEE_PCT}% service fee.`,
      'Once we confirm your payment, the trip is booked. Arrange pickup with your host on WhatsApp.',
      'Any security deposit is paid to the host at pickup and returned after the trip.',
    ]],
    ['For hosts', [
      'List your car with photos, price, area and trip-length limits. We review every listing.',
      'Approve or decline each request. Block dates you need the car yourself.',
      'Hand over the keys on pickup day and mark the trip started; mark it complete when the car is back.',
      `We pay you the rental plus cleaning fee, less a ${HOST_FEE_PCT}% commission, by bank transfer after the trip.`,
    ]],
    ['Timing', [
      'Requests and unpaid approvals expire automatically on the pickup date.',
      'Trips run from the pickup date to the return date; the car is free again on the return day.',
    ]],
  ];
  return (
    <div className="page max-w-3xl space-y-6">
      <h1 className="h1">How IslandDrive works</h1>
      {sections.map(([t, items]) => (
        <section key={t} className="card p-6">
          <h2 className="h2 mb-3">{t}</h2>
          <ol className="list-decimal space-y-2 pl-5 text-ink/90">
            {items.map((i) => <li key={i}>{i}</li>)}
          </ol>
        </section>
      ))}
      <Link href="/cars" className="btn-primary">Find a car</Link>
    </div>
  );
}
