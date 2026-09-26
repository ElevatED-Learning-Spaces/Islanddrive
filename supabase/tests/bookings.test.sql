\o /dev/null
-- Behavioural tests for the booking/car rules. Each block raises on failure.
\set host  '''11111111-1111-1111-1111-111111111111'''
\set guest '''22222222-2222-2222-2222-222222222222'''
\set other '''33333333-3333-3333-3333-333333333333'''
\set admin '''44444444-4444-4444-4444-444444444444'''

insert into auth.users (id) values (:host), (:guest), (:other), (:admin);
update public.profiles set role = 'admin' where id = :admin;
update public.profiles set full_name = 'Kerry-Ann Mohammed' where id = :host;

-- helpers: act as a user through RLS, or as the service role
create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', u::text, false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.as_service() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
end $$;

-- Host creates a car: forced to draft and to their own host_id.
select pg_temp.as_user(:host);
insert into public.cars (host_id, make, model, year, area, daily_rate_cents, status)
values (:host, 'Toyota', 'Aqua', 2017, 'port-of-spain', 35000, 'listed');
do $$ begin
  if (select status from public.cars limit 1) <> 'draft' then
    raise exception 'FAIL: host could insert a listed car';
  end if;
end $$;

-- Host cannot list their own car.
do $$ begin
  begin
    update public.cars set status = 'listed';
    raise exception 'FAIL: host listed own car';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;
update public.cars set status = 'pending_review';

-- Another member cannot see a car that is not listed, nor edit it.
select pg_temp.as_user(:other);
do $$ begin
  if exists (select 1 from public.cars) then raise exception 'FAIL: unlisted car visible'; end if;
end $$;

-- Admin lists it.
select pg_temp.as_user(:admin);
update public.cars set status = 'listed';

-- Anonymous visitors see listed cars but no bookings or profiles.
select pg_temp.as_service();
set role anon;
do $$ begin
  if (select count(*) from public.cars) <> 1 then raise exception 'FAIL: anon cannot see listed car'; end if;
end $$;
do $$ begin
  if exists (select 1 from public.bookings) or exists (select 1 from public.profiles) then
    raise exception 'FAIL: anon read bookings or profiles';
  end if;
end $$;
reset role;

-- Members cannot promote themselves or approve their own permit.
select pg_temp.as_user(:guest);
do $$ begin
  begin
    update public.profiles set role = 'admin' where id = auth.uid();
    raise exception 'FAIL: member became admin';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set permit_status = 'approved' where id = auth.uid();
    raise exception 'FAIL: member approved own permit';
  exception when insufficient_privilege then null;
  end;
end $$;
update public.profiles set full_name = 'Guest Person', phone = '+18687001234' where id = auth.uid();

-- Members cannot write bookings directly.
do $$ begin
  begin
    insert into public.bookings (car_id, guest_id, host_id, start_date, end_date, days,
      daily_rate_cents, rental_cents, total_cents, host_payout_cents)
    select id, auth.uid(), host_id, current_date + 10, current_date + 12, 2, 1, 2, 2, 2
      from public.cars;
    raise exception 'FAIL: member inserted booking';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Service role: valid booking inserts; bad arithmetic is rejected.
select pg_temp.as_service();
create temp table t_ids (k text primary key, id uuid);
with b as (
  insert into public.bookings (car_id, guest_id, host_id, start_date, end_date, days,
    daily_rate_cents, rental_cents, service_fee_cents, total_cents, host_fee_cents, host_payout_cents)
  select c.id, :guest, :host, date '2030-01-10', date '2030-01-13', 3,
         35000, 105000, 10500, 115500, 15750, 89250
    from public.cars c returning id)
insert into t_ids select 'a', id from b;

do $$ begin
  begin
    insert into public.bookings (car_id, guest_id, host_id, start_date, end_date, days,
      daily_rate_cents, rental_cents, total_cents, host_payout_cents)
    select c.id, '22222222-2222-2222-2222-222222222222', c.host_id,
           date '2030-02-01', date '2030-02-03', 2, 35000, 70000, 1, 70000 from public.cars c;
    raise exception 'FAIL: wrong total accepted';
  exception when check_violation then null;
  end;
end $$;

-- Overlapping request is allowed while pending...
with b as (
  insert into public.bookings (car_id, guest_id, host_id, start_date, end_date, days,
    daily_rate_cents, rental_cents, total_cents, host_payout_cents)
  select c.id, :other, :host, date '2030-01-12', date '2030-01-14', 2, 35000, 70000, 70000, 70000
    from public.cars c returning id)
insert into t_ids select 'b', id from b;

-- ...but only one of the two can be approved.
update public.bookings set status = 'approved' where id = (select id from t_ids where k = 'a');
do $$ begin
  begin
    update public.bookings set status = 'approved' where id = (select id from t_ids where k = 'b');
    raise exception 'FAIL: double booking approved';
  exception when exclusion_violation then null;
  end;
end $$;

-- Back-to-back is fine: return day is the next pickup day.
with b as (
  insert into public.bookings (car_id, guest_id, host_id, start_date, end_date, days,
    daily_rate_cents, rental_cents, total_cents, host_payout_cents)
  select c.id, :other, :host, date '2030-01-13', date '2030-01-15', 2, 35000, 70000, 70000, 70000
    from public.cars c returning id)
insert into t_ids select 'c', id from b;
update public.bookings set status = 'approved' where id = (select id from t_ids where k = 'c');

-- Terms are frozen; illegal transitions rejected.
do $$ begin
  begin
    update public.bookings set total_cents = 1, rental_cents = 1 where id = (select id from t_ids where k = 'a');
    raise exception 'FAIL: price changed after request';
  exception when others then if sqlerrm like 'FAIL%' or sqlerrm not like '%frozen%' then raise; end if;
  end;
  begin
    update public.bookings set status = 'completed' where id = (select id from t_ids where k = 'a');
    raise exception 'FAIL: approved jumped to completed';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;
update public.bookings set status = 'paid' where id = (select id from t_ids where k = 'a');
update public.bookings set status = 'active' where id = (select id from t_ids where k = 'a');
update public.bookings set status = 'completed' where id = (select id from t_ids where k = 'a');

-- Host blocks cannot be approved over.
insert into public.car_blocks (car_id, start_date, end_date) select id, date '2030-03-05', date '2030-03-06' from public.cars;
with b as (
  insert into public.bookings (car_id, guest_id, host_id, start_date, end_date, days,
    daily_rate_cents, rental_cents, total_cents, host_payout_cents)
  select c.id, :guest, :host, date '2030-03-06', date '2030-03-08', 2, 35000, 70000, 70000, 70000
    from public.cars c returning id)
insert into t_ids select 'd', id from b;
do $$ begin
  begin
    update public.bookings set status = 'approved' where id = (select id from t_ids where k = 'd');
    raise exception 'FAIL: approved over a block';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

-- Availability helper agrees.
do $$ declare car uuid := (select id from public.cars limit 1); begin
  if exists (select 1 from public.available_car_ids(date '2030-01-11', date '2030-01-12')) then
    raise exception 'FAIL: booked car shown as available';
  end if;
  if not exists (select 1 from public.available_car_ids(date '2030-01-15', date '2030-01-18')) then
    raise exception 'FAIL: free car hidden';
  end if;
  if exists (select 1 from public.available_car_ids(date '2030-03-06', date '2030-03-07')) then
    raise exception 'FAIL: blocked car shown as available';
  end if;
  if (select first_name from public.host_public((select host_id from public.cars limit 1))) <> 'Kerry-Ann' then
    raise exception 'FAIL: host_public name';
  end if;
end $$;

-- Parties see their bookings; strangers see nothing.
select pg_temp.as_user(:guest);
do $$ begin
  if (select count(*) from public.bookings) <> 2 then raise exception 'FAIL: guest sees % bookings', (select count(*) from public.bookings); end if;
end $$;
select pg_temp.as_user(:host);
do $$ begin
  if (select count(*) from public.bookings) <> 4 then raise exception 'FAIL: host bookings'; end if;
end $$;
select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
do $$ begin
  if exists (select 1 from public.bookings) then raise exception 'FAIL: stranger sees bookings'; end if;
end $$;

-- Audit log recorded and cannot be rewritten.
select pg_temp.as_service();
do $$ begin
  if (select count(*) from public.audit_log where table_name = 'bookings') < 8 then
    raise exception 'FAIL: bookings not audited';
  end if;
  begin
    delete from public.audit_log;
    raise exception 'FAIL: audit log deleted';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

-- Stale requests expire.
insert into public.bookings (car_id, guest_id, host_id, start_date, end_date, days,
  daily_rate_cents, rental_cents, total_cents, host_payout_cents)
select c.id, :guest, :host, current_date - 1, current_date + 1, 2, 35000, 70000, 70000, 70000 from public.cars c;
do $$ begin
  if public.expire_stale_bookings() <> 1 then raise exception 'FAIL: expiry'; end if;
end $$;

-- ── review fixes ─────────────────────────────────────────────────────────
-- A guest with a receipt under review is not expired.
select pg_temp.as_service();
with b as (
  insert into public.bookings (car_id, guest_id, host_id, start_date, end_date, days,
    daily_rate_cents, rental_cents, total_cents, host_payout_cents)
  select c.id, :other, :host, current_date + 40, current_date + 42, 2, 35000, 70000, 70000, 70000
    from public.cars c returning id)
insert into t_ids select 'e', id from b;
update public.bookings set status = 'approved' where id = (select id from t_ids where k = 'e');
insert into public.payments (booking_id, payer_id, method, amount_cents)
  select id, :other, 'bank_transfer', 70000 from t_ids where k = 'e';
do $$ begin
  begin
    insert into public.payments (booking_id, payer_id, method, amount_cents)
      select id, '33333333-3333-3333-3333-333333333333', 'bank_transfer', 70000 from t_ids where k = 'e';
    raise exception 'FAIL: two open payments for one booking';
  exception when unique_violation then null;
  end;
end $$;
alter table public.bookings disable trigger bookings_guard;
update public.bookings set start_date = current_date, end_date = current_date + 2 where id = (select id from t_ids where k = 'e');
alter table public.bookings enable trigger bookings_guard;
do $$ begin
  perform public.expire_stale_bookings();
  if (select status from public.bookings where id = (select id from t_ids where k = 'e')) <> 'approved' then
    raise exception 'FAIL: booking with a receipt under review was expired';
  end if;
end $$;

-- Editing a listed car's description sends it back to review; price does not.
select pg_temp.as_user(:host);
update public.cars set daily_rate_cents = 36000;
do $$ begin
  if (select status from public.cars limit 1) <> 'listed' then raise exception 'FAIL: price change forced review'; end if;
end $$;
update public.cars set model = 'Hilux';
do $$ begin
  if (select status from public.cars limit 1) <> 'pending_review' then raise exception 'FAIL: car swap went live'; end if;
end $$;

-- The guest still sees the car they booked while it is not listed.
select pg_temp.as_user(:guest);
do $$ begin
  if (select count(*) from public.cars) <> 1 then raise exception 'FAIL: guest lost sight of booked car'; end if;
end $$;
select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
do $$ begin
  if exists (select 1 from public.cars) then raise exception 'FAIL: stranger sees unlisted car'; end if;
end $$;
