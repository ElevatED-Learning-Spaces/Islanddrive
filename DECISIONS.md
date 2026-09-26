# Decisions & open questions

## Made for the MVP (easy to change)

1. **Separate product, separate repo.** Nothing is shared with ElevatED: no shared infrastructure or data.
2. **Email one-time-code sign-in** instead of phone SMS OTP. Supabase phone OTP needs an SMS provider (Twilio or similar), which costs money per SMS to T&T numbers. The WhatsApp number is collected on the profile and used for click-to-chat.
3. **Fees: 10% guest service fee and 15% host commission**, stored on each booking so changing them never re-prices existing trips. *Owner to confirm.*
4. **Payments: bank transfer + receipt upload, confirmed by an admin.** WiPay card payments come later and need their own merchant account. `WIPAY_*` env vars are placeholders; no card code exists yet.
5. **Refunds and cancellations are handled by hand.** A guest can cancel for free before paying. Once paid, only an admin can cancel, and the refund is sent manually. *Owner to set a cancellation policy (e.g. full refund up to 48 hours before pickup).*
6. **The security deposit is collected by the host at pickup**, not by the platform, so the platform never holds deposits.
7. **Driver's permit verified by an admin before a guest's first booking.** Hosts see the guest's verification status when deciding on a request.
8. **Trips are whole days** (pickup date → return date), with no hourly pricing. Pickup and return times are agreed on WhatsApp.
9. **Host payouts are recorded by an admin** after completion (one per trip, amount taken from the booking). There's no automatic bank payout.
10. **Listings are reviewed once.** After approval, a host can edit details and price without re-review. Existing bookings keep their frozen price.

## Open questions for the owner (before launch)

- **Insurance** — the biggest one. Turo bundles protection plans. In T&T you need a local insurer willing to cover peer-to-peer rental, *or* a requirement that hosts hold commercial / hire-and-drive cover. Check with the Licensing Authority whether private cars can be rented out (hired-car "H" plates).
- Damage and claims process, and trip photos at pickup/return (a check-in photo flow is a natural next feature).
- Minimum guest age and driving experience (e.g. 25+, 3 years licensed).
- Business registration, bank account, and the terms of service / privacy policy (the Data Protection Act).
- Reviews and ratings for guests and hosts (not in the MVP).
- Airport delivery fees, mileage limits, fuel policy.

## Next steps once approved

1. Supabase project + Vercel deploy + a custom domain.
2. WiPay integration (card fee passed to the payer).
3. Check-in/check-out photos, reviews, cancellation policy engine.
4. Notifications (WhatsApp click-to-send templates, email).
5. Sentry + uptime check on `/api/health`, and rate limiting on sign-in and requests.
