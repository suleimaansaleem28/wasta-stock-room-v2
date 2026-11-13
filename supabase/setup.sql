-- WASTA Stock Room: database setup for Supabase (no stock data, no real codes).
-- Paste this whole file into Supabase > SQL Editor > New query, then click Run.
-- Safe to run more than once.

-- 1. Tables ---------------------------------------------------------------
create table if not exists public.items (
  id text primary key,
  garment text not null,
  style text not null default '',
  design text not null default '',
  color text not null,
  color_hex text not null default '#888888',
  size_order text not null default 'S,M,L,XL',
  created bigint not null default 0,
  updated bigint not null default 0
);
create table if not exists public.stock (
  item_id text not null references public.items(id) on delete cascade,
  size text not null,
  qty integer not null default 0 check (qty >= 0),
  primary key (item_id, size)
);
create table if not exists public.app_settings (
  key text primary key,
  value text not null
);
create schema if not exists private;
create table if not exists private.secrets (key text primary key, value text not null);
create table if not exists private.pin_failures (at timestamptz not null default now());

-- 2. Anyone can read stock; nobody can write tables directly -------------------
alter table public.items enable row level security;
alter table public.stock enable row level security;
alter table public.app_settings enable row level security;
drop policy if exists "read items" on public.items;
drop policy if exists "read stock" on public.stock;
drop policy if exists "read settings" on public.app_settings;
create policy "read items" on public.items for select to anon, authenticated using (true);
create policy "read stock" on public.stock for select to anon, authenticated using (true);
create policy "read settings" on public.app_settings for select to anon, authenticated using (true);
revoke all on schema private from anon, authenticated;

-- 3. Changes go through these functions, which check the team PIN ----------------
create or replace function private.pin_check(p_pin text) returns text
language plpgsql security definer set search_path = '' as $$
declare fails int;
begin
  select count(*) into fails from private.pin_failures where at > now() - interval '15 minutes';
  if fails >= 15 then return 'locked'; end if;
  if exists (select 1 from private.secrets where key = 'pin' and value = coalesce(p_pin, '')) then return 'ok'; end if;
  insert into private.pin_failures default values;
  delete from private.pin_failures where at < now() - interval '1 day';
  return 'bad_pin';
end $$;

create or replace function public.check_pin(p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r text := private.pin_check(p_pin);
begin
  return jsonb_build_object('ok', r = 'ok', 'error', case when r = 'ok' then null else r end);
end $$;

create or replace function public.adjust_stock(p_pin text, p_item text, p_size text, p_delta int, p_absolute boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r text := private.pin_check(p_pin); q int;
begin
  if r <> 'ok' then return jsonb_build_object('ok', false, 'error', r); end if;
  if p_delta is null or (not p_absolute and abs(p_delta) > 1000) or (p_absolute and (p_delta < 0 or p_delta > 100000)) then
    return jsonb_build_object('ok', false, 'error', 'bad_amount');
  end if;
  update public.stock
     set qty = case when p_absolute then p_delta else greatest(0, least(100000, qty + p_delta)) end
   where item_id = p_item and size = p_size
  returning qty into q;
  if q is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  update public.items set updated = (extract(epoch from now()) * 1000)::bigint where id = p_item;
  return jsonb_build_object('ok', true, 'qty', q);
end $$;

create or replace function public.save_item(p_pin text, p_item jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r text := private.pin_check(p_pin);
  v_id text := nullif(trim(coalesce(p_item->>'id', '')), '');
  v_garment text := left(trim(coalesce(p_item->>'garment', '')), 60);
  v_style text := left(trim(coalesce(p_item->>'style', '')), 60);
  v_design text := left(trim(coalesce(p_item->>'design', '')), 60);
  v_color text := left(trim(coalesce(p_item->>'color', '')), 60);
  v_hex text := coalesce(p_item->>'colorHex', '');
  v_sizes text[];
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
  s text;
begin
  if r <> 'ok' then return jsonb_build_object('ok', false, 'error', r); end if;
  select array_agg(distinct upper(left(trim(x), 8))) into v_sizes
    from jsonb_array_elements_text(coalesce(p_item->'sizeOrder', '[]'::jsonb)) as x
   where trim(x) ~ '^[A-Za-z0-9 .-]{1,8}$';
  if v_garment = '' or v_color = '' or v_sizes is null then
    return jsonb_build_object('ok', false, 'error', 'missing_fields');
  end if;
  if v_hex !~ '^#[0-9a-fA-F]{6}$' then v_hex := '#888888'; end if;
  if v_id is null then
    v_id := left(trim(both '-' from regexp_replace(lower(concat_ws(' ', v_garment, v_design, v_style, v_color)), '[^a-z0-9]+', '-', 'g')), 100)
            || '-' || substr(md5(random()::text), 1, 6);
  end if;
  insert into public.items (id, garment, style, design, color, color_hex, size_order, created, updated)
  values (v_id, v_garment, v_style, v_design, v_color, v_hex, array_to_string(v_sizes, ','), v_now, v_now)
  on conflict (id) do update set garment = excluded.garment, style = excluded.style, design = excluded.design,
    color = excluded.color, color_hex = excluded.color_hex, size_order = excluded.size_order, updated = excluded.updated;
  delete from public.stock where item_id = v_id and not (size = any (v_sizes));
  foreach s in array v_sizes loop
    insert into public.stock (item_id, size, qty)
    values (v_id, s, greatest(0, least(100000, coalesce((p_item->'sizes'->>s)::int, 0))))
    on conflict (item_id, size) do update set qty = excluded.qty;
  end loop;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.delete_item(p_pin text, p_item text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r text := private.pin_check(p_pin);
begin
  if r <> 'ok' then return jsonb_build_object('ok', false, 'error', r); end if;
  delete from public.items where id = p_item;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.set_low_at(p_pin text, p_value int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r text := private.pin_check(p_pin);
begin
  if r <> 'ok' then return jsonb_build_object('ok', false, 'error', r); end if;
  if p_value is null or p_value < 0 or p_value > 1000 then return jsonb_build_object('ok', false, 'error', 'bad_amount'); end if;
  insert into public.app_settings (key, value) values ('lowAt', p_value::text)
  on conflict (key) do update set value = excluded.value;
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function private.pin_check(text) from public, anon, authenticated;
grant execute on function public.check_pin(text) to anon, authenticated;
grant execute on function public.adjust_stock(text, text, text, int, boolean) to anon, authenticated;
grant execute on function public.save_item(text, jsonb) to anon, authenticated;
grant execute on function public.delete_item(text, text) to anon, authenticated;
grant execute on function public.set_low_at(text, int) to anon, authenticated;

-- 4. Team PIN and passkey: replace both values before running.
insert into private.secrets (key, value) values ('pin', 'CHANGE-ME-PIN') on conflict (key) do nothing;
insert into public.app_settings (key, value) values ('lowAt', '3') on conflict (key) do nothing;

-- 5. Require a passkey to view stock.
-- Paste this whole file into Supabase > SQL Editor > New query, then click Run.
-- Safe to run more than once.

-- Track wrong PIN and wrong passkey tries separately.
alter table private.pin_failures add column if not exists kind text not null default 'pin';

create or replace function private.pin_check(p_pin text) returns text
language plpgsql security definer set search_path = '' as $$
declare fails int;
begin
  select count(*) into fails from private.pin_failures where kind = 'pin' and at > now() - interval '15 minutes';
  if fails >= 15 then return 'locked'; end if;
  if exists (select 1 from private.secrets where key = 'pin' and value = coalesce(p_pin, '')) then return 'ok'; end if;
  insert into private.pin_failures (kind) values ('pin');
  delete from private.pin_failures where at < now() - interval '1 day';
  return 'bad_pin';
end $$;

create or replace function private.view_check(p_code text) returns text
language plpgsql security definer set search_path = '' as $$
declare fails int;
begin
  select count(*) into fails from private.pin_failures where kind = 'view' and at > now() - interval '15 minutes';
  if fails >= 30 then return 'locked'; end if;
  if exists (select 1 from private.secrets where key = 'view_code' and lower(value) = lower(trim(coalesce(p_code, '')))) then return 'ok'; end if;
  insert into private.pin_failures (kind) values ('view');
  delete from private.pin_failures where at < now() - interval '1 day';
  return 'bad_code';
end $$;
revoke execute on function private.view_check(text) from public, anon, authenticated;

-- Stock can now only be read with the passkey.
drop policy if exists "read items" on public.items;
drop policy if exists "read stock" on public.stock;
drop policy if exists "read settings" on public.app_settings;

create or replace function public.get_stock(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r text := private.view_check(p_code);
begin
  if r <> 'ok' then return jsonb_build_object('ok', false, 'error', r); end if;
  return jsonb_build_object(
    'ok', true,
    'lowAt', (select value from public.app_settings where key = 'lowAt'),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'garment', i.garment, 'style', i.style, 'design', i.design, 'color', i.color,
        'color_hex', i.color_hex, 'size_order', i.size_order, 'created', i.created,
        'stock', (select coalesce(jsonb_agg(jsonb_build_object('size', s.size, 'qty', s.qty)), '[]'::jsonb)
                    from public.stock s where s.item_id = i.id)))
      from public.items i), '[]'::jsonb));
end $$;
grant execute on function public.get_stock(text) to anon, authenticated;

-- The passkey (change the text here any time and run just this line again).
insert into private.secrets (key, value) values ('view_code', 'CHANGE-ME-PASSKEY')
on conflict (key) do nothing;
-- To change it later:  update private.secrets set value = 'new-passkey' where key = 'view_code';
