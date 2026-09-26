# IslandDrive — notes for Claude

Turo-style peer-to-peer car rental for Trinidad & Tobago. Read README.md (what exists) and DECISIONS.md (choices + open owner questions) first.

## Conventions
- Supabase clients: `src/lib/supabase/server.ts` (RLS, request cookies), `client.ts` (browser), `admin.ts` (service role, **bypasses RLS** — every caller checks the user and ownership first; never import it client-side).
- Mutations are Server Actions in each route's `actions.ts`. Bookings, payments, blocks and payouts have no user write policies. Car and profile edits use the member's own client, so RLS, column grants and triggers apply.
- Money is integer cents in TTD. Only `src/lib/pricing.ts` computes trip prices. Amounts are never taken from the client. DB CHECKs mirror the arithmetic.
- The booking state machine lives in SQL (`booking_transition_ok`, the `bookings_guard` trigger). `src/lib/booking-status.ts` mirrors it for the UI — change both together.
- No raw status codes on screen: use `labelFor()` / `<StatusChip>` from `src/lib/labels.ts`.
- Dates are 'YYYY-MM-DD' in America/Port_of_Spain (`todayTT()`). Trips are half-open [start, end); host blocks are stored inclusive.
- After a migration that adds columns/tables: `NOTIFY pgrst, 'reload schema'`.

## Before calling anything done
`npm run lint && npm run typecheck && npm test && npm run build`, plus `npm run test:db` for schema changes (needs local Postgres). Check screens at 390px and desktop widths.
