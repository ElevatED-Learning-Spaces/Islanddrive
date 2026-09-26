import type { Metadata } from 'next';
import { Flash } from '@/components/Flash';
import { Info } from '@/components/Info';
import { StatusChip } from '@/components/StatusChip';
import { SubmitButton } from '@/components/SubmitButton';
import { requireMe } from '@/lib/auth';
import { prettyPhone } from '@/lib/phone';
import { saveProfile, uploadPermit } from './actions';

export const metadata: Metadata = { title: 'Account' };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const me = await requireMe('/account');
  const sp = await searchParams;
  const p = me.profile;
  return (
    <div className="page max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="h1">Your account</h1>
        <form action="/auth/signout" method="post"><button className="btn-ghost">Sign out</button></form>
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      <form action={saveProfile} className="card space-y-4 p-6">
        <h2 className="h2">Your details</h2>
        <p className="muted -mt-2">Signed in as {me.email}</p>
        <div>
          <label className="label" htmlFor="full_name">Full name (as on your permit)</label>
          <input id="full_name" name="full_name" required defaultValue={p.full_name ?? ''} className="input" autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="phone">WhatsApp number</label>
          <input id="phone" name="phone" required defaultValue={p.phone ? prettyPhone(p.phone) : ''} className="input" inputMode="tel" autoComplete="tel" placeholder="868 700 1234" />
          <p className="mt-1 text-xs text-ink-soft">Shared with your host or guest once a trip is approved.</p>
        </div>
        <SubmitButton pendingText="Saving…">Save details</SubmitButton>
      </form>

      <section className="card space-y-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="h2 flex items-center gap-2">
            Driver’s permit
            <Info>We check every guest’s Trinidad &amp; Tobago (or international) driver’s permit before their first trip. Only IslandDrive staff can see the photo.</Info>
          </h2>
          <StatusChip kind="permit" code={p.permit_status} />
        </div>
        {p.permit_status === 'rejected' && p.permit_note ? (
          <p className="notice border-red-200 bg-red-50 text-red-800">{p.permit_note}</p>
        ) : null}
        {p.permit_status === 'approved' ? (
          <p className="muted">You’re verified and can book any car.</p>
        ) : (
          <form action={uploadPermit} className="space-y-3">
            <p className="muted">
              {p.permit_status === 'pending' ? 'Received — we’re checking it. You can replace it if needed.' : 'Upload a clear photo of the front of your permit.'}
            </p>
            <input name="permit" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-sea-50 file:px-4 file:py-2 file:font-semibold file:text-sea-700" />
            <SubmitButton pendingText="Uploading…">Upload permit</SubmitButton>
          </form>
        )}
      </section>
    </div>
  );
}
