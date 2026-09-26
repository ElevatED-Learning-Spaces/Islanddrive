# IslandDrive

Peer-to-peer car rental for Trinidad & Tobago (a Turo-style marketplace).
Guests rent cars from local hosts; hosts earn from cars they aren't using.

**Stack:** Next.js 16 (App Router) + TypeScript + Tailwind 4, Supabase (Postgres, Auth, Storage, RLS), Vercel.

## What's in the MVP

| Who | Can do |
|---|---|
| Visitors | Browse and search cars by area (11 Trinidad & Tobago areas) and dates; see live price quotes in TTD |
| Guests | Sign in with an emailed 6-digit code; upload a driver's permit; request a car; pay by bank transfer + receipt upload; message the host on WhatsApp; cancel before paying |
| Hosts | List cars (details, price, deposit, weekly discount, min/max days, delivery); upload photos; block dates; submit for review; approve/decline requests; start and complete trips; see earnings and pending payouts |
| Admins | Review listings, verify driver's permits, confirm payments, record host payouts, see latest bookings |

### Trip lifecycle

```
requested ──approve──▶ approved ──payment confirmed──▶ paid ──start──▶ active ──complete──▶ completed
    │ decline/cancel/expire   │ cancel/expire                │ cancel (admin)
    ▼                          ▼                               ▼
 declined / cancelled / expired
```

- A trip runs from the pickup date to the return date. The car is free again on the return day.
- Requests and unpaid approvals **expire on the pickup date** (daily cron job).
- **Double booking is impossible at the database level**: a Postgres exclusion constraint on `(car, daterange)` covers every approved-or-later trip. When a request is approved, other pending requests for the same dates are declined automatically.

### Money (TTD, integer cents)

- Guest pays: rental (days × daily rate, minus the weekly discount for trips of 7+ days) + cleaning fee + **10% service fee**.
- Host receives: rental + cleaning fee − **15% commission**.
- The security deposit is **not** collected by the platform. The host takes it at pickup.
- Prices are computed on the server only (`src/lib/pricing.ts`), stored on the booking, **frozen by trigger**, and re-checked by DB `CHECK` constraints.
- Both fee percentages are placeholders for the owner to set (see DECISIONS.md).

### Security model

- Every table has RLS enabled and is deny-by-default. Anonymous visitors can read only listed cars, their photos, and areas.
- Members can edit only their own name and phone (column grants). Role and permit status are set by admins only.
- Hosts can't list their own car; a trigger forces new cars to `draft` and allows only legal status moves.
- Bookings, payments, blocks and payouts have **no** user write policies. Every write goes through a server action that checks who you are and what you own, then uses the service role.
- Driver's permits and payment receipts go in private buckets. Admins see them only through 30-minute signed links.
- Changes to profiles, cars, bookings, payments and payouts are recorded in an append-only `audit_log`.

## Running it

```bash
npm install          # .npmrc sets legacy-peer-deps
npm run dev          # http://localhost:3000
```

Without Supabase keys the app runs in **demo mode**: it shows sample cars, and sign-in and bookings are turned off.

### Connecting Supabase

1. Create a Supabase project and copy `.env.example` to `.env.local`, then fill in the URL, the anon key and the service-role key.
2. Apply the migrations in order: `supabase/migrations/*.sql` (SQL editor, or `npx supabase db push` after `npx supabase link`).
3. Auth → Email: keep sign-ups **on** (it's a marketplace). To have the email show the 6-digit code, edit the *Magic Link* template to include `{{ .Token }}`. The link in the email also works via `/auth/callback`.
4. Add `https://<your-domain>/auth/callback` to Auth → URL configuration → Redirect URLs.
5. Make yourself an admin after your first sign-in:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```
6. On Vercel, set the same env vars plus `CRON_SECRET` and the `BANK_*` details guests will see.

## Checks

```bash
npm run lint && npm run typecheck && npm test && npm run build
npm run test:db      # applies the migrations to a throwaway local Postgres and runs supabase/tests/*.test.sql
```

`test:db` covers: double-booking rejection, receipts under review never expiring, only one open receipt per trip, a live car going back to review when its details change, guests still seeing a car they booked, back-to-back trips, host blocks, frozen prices and invalid status moves, a host being unable to list their own car, members being unable to become admin or approve their own permit, direct booking inserts being blocked, what anonymous visitors and strangers can see, audit-log immutability, and expiry.
