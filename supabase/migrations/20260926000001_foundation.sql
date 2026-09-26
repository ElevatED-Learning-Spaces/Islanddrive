-- IslandDrive foundation: people, areas, cars, availability blocks, bookings,
-- payments and the audit log. Every table is default-deny (RLS on, no anon
-- policies except the public catalogue of *listed* cars and their photos).
--
-- Money is integer cents in TTD. Booking prices are computed on the server
-- (src/lib/pricing.ts), stored on the booking row, and frozen by trigger.

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- ── helpers ──────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ── profiles ─────────────────────────────────────────────────────────────
-- One row per auth user. Everyone is a member (can rent and can host);
-- 'admin' is granted by hand in SQL. Members may edit only their name and
-- phone (column grants below); permit review and role are admin/server only.
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  full_name      text check (full_name is null or length(full_name) <= 120),
  phone          text check (phone is null or phone ~ '^\+[0-9]{7,15}$'),
  role           text not null default 'member' check (role in ('member', 'admin')),
  permit_status  text not null default 'none'
                 check (permit_status in ('none', 'pending', 'approved', 'rejected')),
  permit_path    text,
  permit_note    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
create policy profiles_self_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- ── areas (data, not an enum) ───────────────────────────────────────────
create table public.areas (
  slug      text primary key check (slug ~ '^[a-z0-9-]+$'),
  name      text not null,
  island    text not null check (island in ('trinidad', 'tobago')),
  position  int not null default 0
);
alter table public.areas enable row level security;
create policy areas_public_read on public.areas for select to anon, authenticated using (true);
grant select on public.areas to anon, authenticated;

insert into public.areas (slug, name, island, position) values
  ('port-of-spain', 'Port of Spain',          'trinidad', 1),
  ('piarco',        'Piarco Airport',          'trinidad', 2),
  ('chaguanas',     'Chaguanas',               'trinidad', 3),
  ('san-fernando',  'San Fernando',            'trinidad', 4),
  ('arima',         'Arima',                   'trinidad', 5),
  ('diego-martin',  'Diego Martin & Westmoorings', 'trinidad', 6),
  ('couva',         'Couva & Point Lisas',     'trinidad', 7),
  ('sangre-grande', 'Sangre Grande',           'trinidad', 8),
  ('point-fortin',  'Point Fortin',            'trinidad', 9),
  ('scarborough',   'Scarborough',             'tobago',  10),
  ('crown-point',   'Crown Point (ANR Robinson Airport)', 'tobago', 11);

-- ── cars ─────────────────────────────────────────────────────────────────
create table public.cars (
  id                   uuid primary key default gen_random_uuid(),
  host_id              uuid not null references public.profiles(id) on delete restrict,
  make                 text not null check (length(make) between 1 and 40),
  model                text not null check (length(model) between 1 and 60),
  year                 int  not null check (year between 1980 and 2100),
  transmission         text not null default 'automatic' check (transmission in ('automatic', 'manual')),
  seats                int  not null default 5 check (seats between 1 and 15),
  fuel                 text not null default 'gasoline' check (fuel in ('gasoline', 'diesel', 'hybrid', 'electric')),
  area                 text not null references public.areas(slug),
  pickup_notes         text check (pickup_notes is null or length(pickup_notes) <= 500),
  description          text check (description is null or length(description) <= 3000),
  daily_rate_cents     int  not null check (daily_rate_cents between 5000 and 10000000),
  cleaning_fee_cents   int  not null default 0 check (cleaning_fee_cents between 0 and 1000000),
  deposit_cents        int  not null default 0 check (deposit_cents between 0 and 5000000),
  weekly_discount_pct  int  not null default 0 check (weekly_discount_pct between 0 and 50),
  min_days             int  not null default 1 check (min_days between 1 and 30),
  max_days             int  not null default 30 check (max_days between 1 and 90),
  delivery_available   boolean not null default false,
  status               text not null default 'draft'
                       check (status in ('draft', 'pending_review', 'listed', 'paused', 'rejected')),
  review_note          text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (max_days >= min_days)
);
create index cars_host_idx on public.cars (host_id);
create index cars_area_status_idx on public.cars (area, status);
create trigger cars_touch before update on public.cars
  for each row execute function public.touch_updated_at();

-- A host may move their own car only along these edges; admins (and the
-- service role, auth.uid() is null) may set any status. Hosts can never list
-- a car themselves — listing goes through review.
create or replace function public.cars_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if new.host_id is distinct from old.host_id then
    raise exception 'car host cannot change';
  end if;
  if new.status is distinct from old.status and not (
       (old.status in ('draft', 'rejected') and new.status = 'pending_review')
    or (old.status = 'pending_review' and new.status = 'draft')
    or (old.status = 'listed' and new.status = 'paused')
    or (old.status = 'paused' and new.status = 'listed')
  ) then
    raise exception 'car status % -> % not allowed', old.status, new.status;
  end if;
  if new.review_note is distinct from old.review_note then
    raise exception 'review note is set by admins';
  end if;
  return new;
end $$;
create trigger cars_guard before update on public.cars
  for each row execute function public.cars_guard();

create or replace function public.cars_insert_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.host_id := auth.uid();
    new.status := 'draft';
    new.review_note := null;
  end if;
  return new;
end $$;
create trigger cars_insert_guard before insert on public.cars
  for each row execute function public.cars_insert_guard();

alter table public.cars enable row level security;
create policy cars_public_read on public.cars for select to anon, authenticated
  using (status = 'listed' or host_id = auth.uid() or public.is_admin());
create policy cars_host_insert on public.cars for insert to authenticated
  with check (host_id = auth.uid());
create policy cars_host_update on public.cars for update to authenticated
  using (host_id = auth.uid() or public.is_admin())
  with check (host_id = auth.uid() or public.is_admin());
grant select on public.cars to anon, authenticated;
grant insert, update on public.cars to authenticated;

-- ── car photos (public bucket 'car-photos'; uploads go through the server) ─
create table public.car_photos (
  id          uuid primary key default gen_random_uuid(),
  car_id      uuid not null references public.cars(id) on delete cascade,
  path        text not null,
  position    int  not null default 0,
  created_at  timestamptz not null default now()
);
create index car_photos_car_idx on public.car_photos (car_id, position);
alter table public.car_photos enable row level security;
create policy car_photos_read on public.car_photos for select to anon, authenticated
  using (exists (select 1 from public.cars c where c.id = car_id
                 and (c.status = 'listed' or c.host_id = auth.uid() or public.is_admin())));
grant select on public.car_photos to anon, authenticated;

-- ── host-blocked dates (inclusive ranges) ───────────────────────────────
create table public.car_blocks (
  id          uuid primary key default gen_random_uuid(),
  car_id      uuid not null references public.cars(id) on delete cascade,
  start_date  date not null,
  end_date    date not null,
  note        text check (note is null or length(note) <= 200),
  created_at  timestamptz not null default now(),
  check (end_date >= start_date)
);
create index car_blocks_car_idx on public.car_blocks (car_id, start_date);
alter table public.car_blocks enable row level security;
create policy car_blocks_host_read on public.car_blocks for select to authenticated
  using (exists (select 1 from public.cars c where c.id = car_id
                 and (c.host_id = auth.uid() or public.is_admin())));
grant select on public.car_blocks to authenticated;

-- ── bookings ─────────────────────────────────────────────────────────────
-- A trip runs from start_date (pickup) to end_date (return); days = end - start.
-- The return day is free for the next pickup: ranges are half-open [start, end).
-- No insert/update policies: every write is a server action on the service
-- role after its own authorization check. The exclusion constraint makes a
-- double booking impossible even if two hosts' approvals race.
create table public.bookings (
  id                   uuid primary key default gen_random_uuid(),
  car_id               uuid not null references public.cars(id) on delete restrict,
  guest_id             uuid not null references public.profiles(id) on delete restrict,
  host_id              uuid not null references public.profiles(id) on delete restrict,
  start_date           date not null,
  end_date             date not null,
  days                 int  not null check (days >= 1),
  daily_rate_cents     int  not null check (daily_rate_cents >= 0),
  discount_cents       int  not null default 0 check (discount_cents >= 0),
  rental_cents         int  not null check (rental_cents >= 0),
  cleaning_fee_cents   int  not null default 0 check (cleaning_fee_cents >= 0),
  service_fee_cents    int  not null default 0 check (service_fee_cents >= 0),
  total_cents          int  not null check (total_cents >= 0),
  deposit_cents        int  not null default 0 check (deposit_cents >= 0),
  host_fee_cents       int  not null default 0 check (host_fee_cents >= 0),
  host_payout_cents    int  not null check (host_payout_cents >= 0),
  currency             text not null default 'TTD' check (currency = 'TTD'),
  status               text not null default 'requested'
                       check (status in ('requested', 'approved', 'declined', 'cancelled',
                                         'expired', 'paid', 'active', 'completed')),
  guest_message        text check (guest_message is null or length(guest_message) <= 1000),
  status_note          text check (status_note is null or length(status_note) <= 500),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (end_date > start_date),
  check (days = end_date - start_date),
  check (guest_id <> host_id),
  check (rental_cents = days * daily_rate_cents - discount_cents),
  check (total_cents = rental_cents + cleaning_fee_cents + service_fee_cents),
  check (host_payout_cents = rental_cents + cleaning_fee_cents - host_fee_cents),
  constraint bookings_no_overlap exclude using gist (
    car_id with =,
    daterange(start_date, end_date, '[)') with &&
  ) where (status in ('approved', 'paid', 'active', 'completed'))
);
create index bookings_guest_idx on public.bookings (guest_id, start_date desc);
create index bookings_host_idx on public.bookings (host_id, start_date desc);
create index bookings_car_idx on public.bookings (car_id, start_date);
create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();

-- Legal status moves, enforced for every writer including the service role.
create or replace function public.booking_transition_ok(from_s text, to_s text) returns boolean
language sql immutable as $$
  select case from_s
    when 'requested' then to_s in ('approved', 'declined', 'cancelled', 'expired')
    when 'approved'  then to_s in ('paid', 'cancelled', 'expired')
    when 'paid'      then to_s in ('active', 'cancelled')
    when 'active'    then to_s in ('completed')
    else false
  end;
$$;

create or replace function public.bookings_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'requested' then
      raise exception 'a booking starts as requested';
    end if;
  else
    -- Price, parties and dates are frozen once requested.
    if (new.car_id, new.guest_id, new.host_id, new.start_date, new.end_date, new.days,
        new.daily_rate_cents, new.discount_cents, new.rental_cents, new.cleaning_fee_cents,
        new.service_fee_cents, new.total_cents, new.deposit_cents, new.host_fee_cents,
        new.host_payout_cents, new.currency, new.created_at)
       is distinct from
       (old.car_id, old.guest_id, old.host_id, old.start_date, old.end_date, old.days,
        old.daily_rate_cents, old.discount_cents, old.rental_cents, old.cleaning_fee_cents,
        old.service_fee_cents, old.total_cents, old.deposit_cents, old.host_fee_cents,
        old.host_payout_cents, old.currency, old.created_at) then
      raise exception 'booking terms are frozen';
    end if;
    if new.status is distinct from old.status
       and not public.booking_transition_ok(old.status, new.status) then
      raise exception 'booking status % -> % not allowed', old.status, new.status;
    end if;
  end if;
  -- Host-blocked dates can never be approved over.
  if new.status in ('approved', 'paid', 'active')
     and (tg_op = 'INSERT' or old.status is distinct from new.status)
     and exists (select 1 from public.car_blocks b
                 where b.car_id = new.car_id
                   and daterange(b.start_date, b.end_date, '[]')
                       && daterange(new.start_date, new.end_date, '[)')) then
    raise exception 'those dates are blocked by the host';
  end if;
  return new;
end $$;
create trigger bookings_guard before insert or update on public.bookings
  for each row execute function public.bookings_guard();

alter table public.bookings enable row level security;
create policy bookings_party_read on public.bookings for select to authenticated
  using (guest_id = auth.uid() or host_id = auth.uid() or public.is_admin());
grant select on public.bookings to authenticated;

-- ── payments (bank-transfer proof now; WiPay later) ─────────────────────
create table public.payments (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references public.bookings(id) on delete restrict,
  payer_id      uuid not null references public.profiles(id) on delete restrict,
  method        text not null check (method in ('bank_transfer', 'wipay')),
  amount_cents  int  not null check (amount_cents > 0),
  reference     text check (reference is null or length(reference) <= 120),
  proof_path    text,
  status        text not null default 'submitted' check (status in ('submitted', 'confirmed', 'rejected')),
  review_note   text,
  reviewed_by   uuid references public.profiles(id),
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index payments_booking_idx on public.payments (booking_id);
create unique index payments_one_confirmed on public.payments (booking_id) where status = 'confirmed';
alter table public.payments enable row level security;
create policy payments_party_read on public.payments for select to authenticated
  using (payer_id = auth.uid() or public.is_admin());
grant select on public.payments to authenticated;

-- ── audit log (append-only) ──────────────────────────────────────────────
create table public.audit_log (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  row_id      uuid,
  action      text not null,
  actor       uuid,
  old_row     jsonb,
  new_row     jsonb,
  at          timestamptz not null default now()
);
create index audit_log_row_idx on public.audit_log (table_name, row_id, at desc);

create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (table_name, row_id, action, actor, old_row, new_row)
  values (tg_table_name,
          case when tg_op = 'DELETE' then old.id else new.id end,
          lower(tg_op), auth.uid(),
          case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end);
  return null;
end $$;

create or replace function public.audit_log_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_log is append-only';
end $$;
create trigger audit_log_immutable before update or delete on public.audit_log
  for each row execute function public.audit_log_immutable();

create trigger audit_profiles after insert or update or delete on public.profiles
  for each row execute function public.audit_row();
create trigger audit_cars after insert or update or delete on public.cars
  for each row execute function public.audit_row();
create trigger audit_bookings after insert or update or delete on public.bookings
  for each row execute function public.audit_row();
create trigger audit_payments after insert or update or delete on public.payments
  for each row execute function public.audit_row();

alter table public.audit_log enable row level security;
create policy audit_admin_read on public.audit_log for select to authenticated
  using (public.is_admin());
grant select on public.audit_log to authenticated;

-- ── public read helpers (security definer, narrow outputs) ──────────────
-- Dates a listed car is unavailable: approved+ bookings and host blocks.
-- Exposes only dates — never who booked.
create or replace function public.car_busy_ranges(p_car uuid)
returns table (start_date date, end_date date)
language sql stable security definer set search_path = public as $$
  select b.start_date, b.end_date from public.bookings b
    join public.cars c on c.id = b.car_id
   where b.car_id = p_car and c.status = 'listed'
     and b.status in ('approved', 'paid', 'active', 'completed')
     and b.end_date >= current_date
  union all
  select k.start_date, k.end_date + 1 from public.car_blocks k
    join public.cars c on c.id = k.car_id
   where k.car_id = p_car and c.status = 'listed' and k.end_date >= current_date
  order by 1;
$$;

-- Listed cars free for the whole trip [p_start, p_end).
create or replace function public.available_car_ids(p_start date, p_end date)
returns setof uuid
language sql stable security definer set search_path = public as $$
  select c.id from public.cars c
   where c.status = 'listed'
     and not exists (select 1 from public.bookings b
                      where b.car_id = c.id
                        and b.status in ('approved', 'paid', 'active', 'completed')
                        and daterange(b.start_date, b.end_date, '[)') && daterange(p_start, p_end, '[)'))
     and not exists (select 1 from public.car_blocks k
                      where k.car_id = c.id
                        and daterange(k.start_date, k.end_date, '[]') && daterange(p_start, p_end, '[)'));
$$;

-- What a guest may see about a host: first name, member-since, trips hosted.
create or replace function public.host_public(p_host uuid)
returns table (first_name text, member_since date, trips int)
language sql stable security definer set search_path = public as $$
  select split_part(coalesce(nullif(trim(p.full_name), ''), 'Host'), ' ', 1),
         p.created_at::date,
         (select count(*)::int from public.bookings b
           where b.host_id = p.id and b.status = 'completed')
    from public.profiles p
   where p.id = p_host
     and exists (select 1 from public.cars c where c.host_id = p.id and c.status = 'listed');
$$;

-- Requests nobody acted on before pickup, and approvals never paid for, expire.
create or replace function public.expire_stale_bookings() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.bookings set status = 'expired',
         status_note = 'Expired: not confirmed before the pickup date'
   where status in ('requested', 'approved')
     and start_date <= (now() at time zone 'America/Port_of_Spain')::date;
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.expire_stale_bookings() from public, anon, authenticated;
grant execute on function public.car_busy_ranges(uuid) to anon, authenticated;
grant execute on function public.available_car_ids(date, date) to anon, authenticated;
grant execute on function public.host_public(uuid) to anon, authenticated;

-- ── host payouts (one per completed booking, recorded by an admin) ──────
create table public.host_payouts (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null unique references public.bookings(id) on delete restrict,
  host_id       uuid not null references public.profiles(id) on delete restrict,
  amount_cents  int  not null check (amount_cents >= 0),
  reference     text check (reference is null or length(reference) <= 120),
  paid_at       timestamptz not null default now(),
  recorded_by   uuid references public.profiles(id)
);
alter table public.host_payouts enable row level security;
create policy host_payouts_read on public.host_payouts for select to authenticated
  using (host_id = auth.uid() or public.is_admin());
grant select on public.host_payouts to authenticated;
create trigger audit_host_payouts after insert or update or delete on public.host_payouts
  for each row execute function public.audit_row();
