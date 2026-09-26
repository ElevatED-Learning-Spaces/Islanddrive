-- Storage buckets. All uploads go through server actions on the service role
-- (after an ownership check, with type and size limits), so there are no
-- storage.objects insert policies for users at all.
--   car-photos : public read (listing photos are meant to be seen)
--   permits    : private — driver's permits, read via short-lived signed URLs
--   proofs     : private — bank-transfer receipts, same
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('car-photos', 'car-photos', true,  8388608, array['image/jpeg', 'image/png', 'image/webp']),
  ('permits',    'permits',    false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('proofs',     'proofs',     false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
