-- =====================================================================
-- Aqin Tani — skema Supabase
-- Jalankan SEKALI di Supabase: Dashboard → SQL Editor → New query →
-- tempel seluruh isi file ini → Run. Aman dijalankan ulang (idempotent).
--
-- Desain:
--   * Setiap "koleksi" dari aplikasi lama (MongoDB) menjadi satu tabel
--     dengan kolom `doc jsonb`. Bentuk data persis sama dengan versi lama,
--     jadi halaman-halaman aplikasi tidak perlu diubah.
--   * Fungsi mq_* meniru perintah MongoDB (find, update $set/$inc, dst.)
--     dan berjalan dengan hak akses pengguna yang login (RLS berlaku).
--   * Hak akses per peran diatur di tabel app_permissions.
--   * Stok total produk dihitung otomatis oleh trigger dari warehouse_stock.
-- =====================================================================

set client_min_messages = warning;

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Profil pengguna (login memakai Supabase Auth)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default '',
  role text not null default 'cashier'
    check (role in ('admin','manager','office_staff','cashier','canvasser')),
  canvasser_id text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.app_role() in ('admin','manager','office_staff'));
-- Perubahan profil hanya lewat fungsi admin_* / update_my_profile di bawah.

-- ---------------------------------------------------------------------
-- Hak akses per peran per koleksi
-- ---------------------------------------------------------------------
create table if not exists public.app_permissions (
  role text not null,
  coll text not null,
  can_read boolean not null default false,
  can_write boolean not null default false,
  primary key (role, coll)
);
alter table public.app_permissions enable row level security;
drop policy if exists perms_read on public.app_permissions;
create policy perms_read on public.app_permissions for select to authenticated using (true);

create or replace function public.mq_collections() returns text[]
language sql immutable as $$
  select array[
    'store_settings','categories','suppliers','products','warehouses','warehouse_stock',
    'purchases','payment_history','transactions','returns','pos_returns','shifts',
    'partner_stores','partner_orders','partner_prices','canvassers','canvasser_expenses',
    'vehicles','vehicle_stock','stock_adjustments','stock_transfers','price_history',
    'audit_log','personal_loans','loan_payments','farmers','farmer_transactions','farmer_payments'
  ]
$$;

-- Isi ulang tabel hak akses (sumber kebenaran ada di sini)
delete from public.app_permissions;
insert into public.app_permissions(role, coll, can_read, can_write)
select r, c, true, true
from unnest(array['admin']) r, unnest(public.mq_collections()) c;
-- manager & karyawan kantor: semua kecuali yang khusus admin
insert into public.app_permissions(role, coll, can_read, can_write)
select r, c,
  true,
  not (c in ('store_settings','canvassers'))
from unnest(array['manager','office_staff']) r, unnest(public.mq_collections()) c
where not (r = 'office_staff' and c in ('personal_loans','loan_payments'))
  and not (c = 'audit_log' and r = 'office_staff');
insert into public.app_permissions(role, coll, can_read, can_write) values
  ('office_staff','audit_log', false, true);
-- kasir
insert into public.app_permissions(role, coll, can_read, can_write)
select 'cashier', c, true, c in (
  'transactions','warehouse_stock','shifts','pos_returns','returns','farmers',
  'farmer_transactions','farmer_payments','stock_transfers')
from unnest(array[
  'products','categories','warehouses','warehouse_stock','store_settings','transactions',
  'shifts','pos_returns','returns','farmers','farmer_transactions','farmer_payments',
  'stock_transfers','vehicles','canvassers','suppliers']) c;
insert into public.app_permissions(role, coll, can_read, can_write) values ('cashier','audit_log', false, true);
-- kanvaser
insert into public.app_permissions(role, coll, can_read, can_write)
select 'canvasser', c, true, c in (
  'partner_orders','partner_stores','warehouse_stock','vehicle_stock','payment_history',
  'canvasser_expenses','returns')
from unnest(array[
  'partner_orders','partner_stores','products','warehouse_stock','warehouses','vehicles',
  'vehicle_stock','canvassers','categories','store_settings','payment_history',
  'canvasser_expenses','partner_prices','returns']) c;
insert into public.app_permissions(role, coll, can_read, can_write) values ('canvasser','audit_log', false, true);

create or replace function public.mq_allowed(p_coll text, p_mode text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case when p_mode = 'r' then can_read else can_write end
    from public.app_permissions
    where role = public.app_role() and coll = p_coll
  ), false)
$$;

-- ---------------------------------------------------------------------
-- Tabel koleksi
-- ---------------------------------------------------------------------
do $$
declare c text;
begin
  foreach c in array public.mq_collections() loop
    execute format('create table if not exists public.%I (
      pk bigint generated always as identity primary key,
      doc jsonb not null)', c);
    execute format('alter table public.%I enable row level security', c);
    execute format('drop policy if exists %I on public.%I', c || '_r', c);
    execute format('create policy %I on public.%I for select to authenticated using (public.mq_allowed(%L, ''r''))', c || '_r', c, c);
    execute format('drop policy if exists %I on public.%I', c || '_i', c);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.mq_allowed(%L, ''w''))', c || '_i', c, c);
    execute format('drop policy if exists %I on public.%I', c || '_u', c);
    execute format('create policy %I on public.%I for update to authenticated using (public.mq_allowed(%L, ''w'')) with check (public.mq_allowed(%L, ''w''))', c || '_u', c, c, c);
    execute format('drop policy if exists %I on public.%I', c || '_d', c);
    execute format('create policy %I on public.%I for delete to authenticated using (public.mq_allowed(%L, ''w''))', c || '_d', c, c);
    -- update/delete butuh baca baris; pastikan penulis juga boleh membaca untuk keperluan itu
    execute format('drop policy if exists %I on public.%I', c || '_rw', c);
    execute format('create policy %I on public.%I for select to authenticated using (public.mq_allowed(%L, ''w''))', c || '_rw', c, c);
    execute format('create index if not exists %I on public.%I ((doc->>''id''))', c || '_id_idx', c);
  end loop;
end $$;

create index if not exists transactions_date_idx on public.transactions (((doc->>'date') collate "C"));
create index if not exists partner_orders_date_idx on public.partner_orders (((doc->>'date') collate "C"));
create index if not exists partner_orders_store_idx on public.partner_orders ((doc->>'partner_store_id'));
create index if not exists partner_orders_canv_idx on public.partner_orders ((doc->>'canvasser_id'));
create index if not exists purchases_supplier_idx on public.purchases ((doc->>'supplier_id'));
create index if not exists ws_product_idx on public.warehouse_stock ((doc->>'product_id'), (doc->>'warehouse_id'));
create index if not exists vs_vehicle_idx on public.vehicle_stock ((doc->>'vehicle_id'));
create index if not exists payhist_ref_idx on public.payment_history ((doc->>'reference_id'));
create index if not exists audit_ts_idx on public.audit_log (((doc->>'timestamp') collate "C"));
create index if not exists farmer_tx_idx on public.farmer_transactions ((doc->>'farmer_id'));

-- ---------------------------------------------------------------------
-- Penerjemah filter ala MongoDB → SQL
-- ---------------------------------------------------------------------
create or replace function public.mq_path(p_key text) returns text
language sql immutable as $$
  select case when strpos(p_key, '.') = 0
    then format('(doc -> %L)', p_key)
    else format('(doc #> %L)', '{' || replace(p_key, '.', ',') || '}') end
$$;

create or replace function public.mq_tpath(p_key text) returns text
language sql immutable as $$
  select case when strpos(p_key, '.') = 0
    then format('(doc ->> %L)', p_key)
    else format('(doc #>> %L)', '{' || replace(p_key, '.', ',') || '}') end
$$;

create or replace function public.mq_eq(p_key text, v jsonb) returns text
language plpgsql immutable as $$
declare p text := public.mq_path(p_key);
begin
  if v is null or jsonb_typeof(v) = 'null' then
    return format('(%s is null or %s = ''null''::jsonb)', p, p);
  elsif jsonb_typeof(v) = 'string' then
    -- bentuk ->> agar indeks dipakai; juga cocok bila field berupa array berisi nilai itu
    return format('(%s = %L or (jsonb_typeof(%s) = ''array'' and %s @> %L::jsonb))',
      public.mq_tpath(p_key), v #>> '{}', p, p, jsonb_build_array(v)::text);
  else
    return format('(%s = %L::jsonb or (jsonb_typeof(%s) = ''array'' and %s @> %L::jsonb))',
      p, v::text, p, p, jsonb_build_array(v)::text);
  end if;
end $$;

create or replace function public.mq_cmp(p_key text, op text, v jsonb) returns text
language plpgsql immutable as $$
begin
  if jsonb_typeof(v) = 'string' then
    return format('(jsonb_typeof(%s) = ''string'' and (%s collate "C") %s %L)',
      public.mq_path(p_key), public.mq_tpath(p_key), op, v #>> '{}');
  else
    return format('(jsonb_typeof(%s) = %L and %s %s %L::jsonb)',
      public.mq_path(p_key), jsonb_typeof(v), public.mq_path(p_key), op, v::text);
  end if;
end $$;

create or replace function public.mq_where(f jsonb) returns text
language plpgsql immutable as $$
declare
  k text; v jsonb; op text; ov jsonb; parts text[] := '{}'; sub text[]; e jsonb; flags text;
begin
  if f is null or f = '{}'::jsonb then return 'true'; end if;
  for k, v in select * from jsonb_each(f) loop
    if k = '$or' or k = '$and' or k = '$nor' then
      sub := '{}';
      for e in select * from jsonb_array_elements(v) loop
        sub := sub || ('(' || public.mq_where(e) || ')');
      end loop;
      if coalesce(array_length(sub, 1), 0) = 0 then
        parts := parts || case when k = '$or' then 'false' else 'true' end;
      elsif k = '$or' then parts := parts || ('(' || array_to_string(sub, ' or ') || ')');
      elsif k = '$and' then parts := parts || ('(' || array_to_string(sub, ' and ') || ')');
      else parts := parts || ('not (' || array_to_string(sub, ' or ') || ')');
      end if;
    elsif jsonb_typeof(v) = 'object' and exists (select 1 from jsonb_object_keys(v) x where x like '$%') then
      flags := coalesce(v ->> '$options', '');
      for op, ov in select * from jsonb_each(v) loop
        if op = '$eq' then parts := parts || public.mq_eq(k, ov);
        elsif op = '$ne' then parts := parts || ('coalesce(not ' || public.mq_eq(k, ov) || ', true)');
        elsif op = '$gt' then parts := parts || public.mq_cmp(k, '>', ov);
        elsif op = '$gte' then parts := parts || public.mq_cmp(k, '>=', ov);
        elsif op = '$lt' then parts := parts || public.mq_cmp(k, '<', ov);
        elsif op = '$lte' then parts := parts || public.mq_cmp(k, '<=', ov);
        elsif op = '$in' or op = '$nin' then
          sub := '{}';
          for e in select * from jsonb_array_elements(ov) loop
            sub := sub || public.mq_eq(k, e);
          end loop;
          if coalesce(array_length(sub, 1), 0) = 0 then
            parts := parts || case when op = '$in' then 'false' else 'true' end;
          elsif op = '$in' then parts := parts || ('(' || array_to_string(sub, ' or ') || ')');
          else parts := parts || ('coalesce(not (' || array_to_string(sub, ' or ') || '), true)');
          end if;
        elsif op = '$exists' then
          parts := parts || case when ov = 'true'::jsonb
            then format('(%s is not null)', public.mq_path(k))
            else format('(%s is null)', public.mq_path(k)) end;
        elsif op = '$regex' then
          parts := parts || format('(%s %s %L)', public.mq_tpath(k),
            case when strpos(flags, 'i') > 0 then '~*' else '~' end, ov #>> '{}');
        elsif op = '$icontains' then
          -- pencarian teks biasa (tanpa regex), tidak peka huruf besar/kecil
          parts := parts || format('(strpos(lower(coalesce(%s, '''')), lower(%L)) > 0)',
            public.mq_tpath(k), ov #>> '{}');
        elsif op = '$options' then null;
        else raise exception 'Operator % tidak didukung', op;
        end if;
      end loop;
    else
      parts := parts || public.mq_eq(k, v);
    end if;
  end loop;
  return array_to_string(parts, ' and ');
end $$;

create or replace function public.mq_order(s jsonb) returns text
language plpgsql immutable as $$
declare k text; v jsonb; parts text[] := '{}';
begin
  if s is null or s = '{}'::jsonb or s = '[]'::jsonb then return 'pk'; end if;
  if jsonb_typeof(s) = 'array' then
    for v in select * from jsonb_array_elements(s) loop
      k := v ->> 0;
      parts := parts || format('(case when jsonb_typeof(%s) = ''string'' then null else %s end) %s, (%s collate "C") %s',
        public.mq_path(k), public.mq_path(k), case when (v ->> 1)::int < 0 then 'desc nulls last' else 'asc nulls first' end,
        public.mq_tpath(k), case when (v ->> 1)::int < 0 then 'desc nulls last' else 'asc nulls first' end);
    end loop;
  end if;
  return array_to_string(parts || array['pk'], ', ');
end $$;

create or replace function public.mq_project(p jsonb) returns text
language plpgsql immutable as $$
declare incl text[]; excl text[];
begin
  if p is null or p = '{}'::jsonb then return 'doc'; end if;
  select array_agg(key) filter (where value::text not in ('0','false') and key <> '_id'),
         array_agg(key) filter (where value::text in ('0','false') and key <> '_id')
    into incl, excl from jsonb_each(p);
  if incl is not null then
    return format('(select coalesce(jsonb_object_agg(key, value), ''{}''::jsonb) from jsonb_each(doc) where key = any(%L::text[]))', incl);
  elsif excl is not null then
    return format('(doc - %L::text[])', excl);
  end if;
  return 'doc';
end $$;

create or replace function public.mq_check(p_coll text) returns void
language plpgsql stable as $$
begin
  if not (p_coll = any(public.mq_collections())) then
    raise exception 'Koleksi % tidak dikenal', p_coll;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Operasi baca
-- ---------------------------------------------------------------------
create or replace function public.mq_find(
  p_coll text, p_filter jsonb default '{}', p_sort jsonb default null,
  p_skip int default 0, p_limit int default null, p_proj jsonb default null)
returns setof jsonb language plpgsql stable as $$
begin
  perform public.mq_check(p_coll);
  return query execute format('select %s from public.%I where %s order by %s offset %s %s',
    public.mq_project(p_proj), p_coll, public.mq_where(p_filter), public.mq_order(p_sort),
    greatest(coalesce(p_skip, 0), 0),
    case when p_limit is null or p_limit <= 0 then '' else 'limit ' || p_limit end);
end $$;

create or replace function public.mq_count(p_coll text, p_filter jsonb default '{}')
returns bigint language plpgsql stable as $$
declare n bigint;
begin
  perform public.mq_check(p_coll);
  execute format('select count(*) from public.%I where %s', p_coll, public.mq_where(p_filter)) into n;
  return n;
end $$;

create or replace function public.mq_distinct(p_coll text, p_key text, p_filter jsonb default '{}')
returns setof jsonb language plpgsql stable as $$
begin
  perform public.mq_check(p_coll);
  return query execute format('select distinct %s from public.%I where %s and %s is not null',
    public.mq_path(p_key), p_coll, public.mq_where(p_filter), public.mq_path(p_key));
end $$;

-- ---------------------------------------------------------------------
-- Operasi tulis
-- ---------------------------------------------------------------------
create or replace function public.mq_set_path(d jsonb, path text[], val jsonb) returns jsonb
language plpgsql immutable as $$
declare sub jsonb;
begin
  d := coalesce(d, '{}'::jsonb);
  if array_length(path, 1) = 1 then
    return jsonb_set(d, path, coalesce(val, 'null'::jsonb), true);
  end if;
  sub := d -> path[1];
  if sub is null or jsonb_typeof(sub) <> 'object' then sub := '{}'::jsonb; end if;
  return jsonb_set(d, array[path[1]], public.mq_set_path(sub, path[2:], val), true);
end $$;

create or replace function public.mq_apply(d jsonb, u jsonb, is_insert boolean default false)
returns jsonb language plpgsql immutable as $$
declare op text; args jsonb; k text; v jsonb; path text[]; cur jsonb;
begin
  if not exists (select 1 from jsonb_object_keys(u) x where x like '$%') then
    -- dokumen pengganti penuh; pertahankan id lama bila tidak disebut
    return case when d ? 'id' and not u ? 'id' then u || jsonb_build_object('id', d -> 'id') else u end;
  end if;
  for op, args in select * from jsonb_each(u) loop
    for k, v in select * from jsonb_each(args) loop
      path := string_to_array(k, '.');
      if op = '$set' or (op = '$setOnInsert' and is_insert) then
        d := public.mq_set_path(d, path, v);
      elsif op = '$unset' then
        d := d #- path;
      elsif op = '$inc' then
        cur := d #> path;
        d := public.mq_set_path(d, path, to_jsonb(
          (case when jsonb_typeof(cur) = 'number' then (cur #>> '{}')::numeric else 0 end) + (v #>> '{}')::numeric));
      elsif op = '$push' then
        cur := d #> path;
        if cur is null or jsonb_typeof(cur) <> 'array' then cur := '[]'::jsonb; end if;
        d := public.mq_set_path(d, path, cur || jsonb_build_array(v));
      elsif op = '$setOnInsert' then null;
      else raise exception 'Operator update % tidak didukung', op;
      end if;
    end loop;
  end loop;
  return d;
end $$;

create or replace function public.mq_insert(p_coll text, p_docs jsonb)
returns int language plpgsql as $$
declare n int;
begin
  perform public.mq_check(p_coll);
  if jsonb_typeof(p_docs) = 'object' then p_docs := jsonb_build_array(p_docs); end if;
  execute format('insert into public.%I(doc) select value - ''_id'' from jsonb_array_elements($1)', p_coll) using p_docs;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.mq_update(
  p_coll text, p_filter jsonb, p_update jsonb,
  p_multi boolean default false, p_upsert boolean default false, p_return text default null)
returns jsonb language plpgsql as $$
declare
  r record; newdoc jsonb; matched int := 0; modified int := 0; ret jsonb := null; base jsonb := '{}'; k text; v jsonb;
begin
  perform public.mq_check(p_coll);
  for r in execute format('select pk, doc from public.%I where %s order by pk %s for update',
      p_coll, public.mq_where(p_filter), case when p_multi then '' else 'limit 1' end) loop
    matched := matched + 1;
    newdoc := public.mq_apply(r.doc, p_update, false);
    if newdoc is distinct from r.doc then
      execute format('update public.%I set doc = $1 where pk = $2', p_coll) using newdoc, r.pk;
      modified := modified + 1;
    end if;
    if ret is null then ret := case when p_return = 'before' then r.doc else newdoc end; end if;
  end loop;
  if matched = 0 and p_upsert then
    for k, v in select * from jsonb_each(coalesce(p_filter, '{}')) loop
      if k not like '$%' and not (jsonb_typeof(v) = 'object') then
        base := public.mq_set_path(base, string_to_array(k, '.'), v);
      end if;
    end loop;
    newdoc := public.mq_apply(base, p_update, true);
    execute format('insert into public.%I(doc) values ($1)', p_coll) using newdoc;
    return jsonb_build_object('matched', 0, 'modified', 0, 'upserted', true,
      'doc', case when p_return = 'after' then newdoc else null end);
  end if;
  return jsonb_build_object('matched', matched, 'modified', modified, 'upserted', false,
    'doc', case when p_return is null then null else ret end);
end $$;

create or replace function public.mq_delete(p_coll text, p_filter jsonb, p_multi boolean default false)
returns int language plpgsql as $$
declare n int;
begin
  perform public.mq_check(p_coll);
  execute format('delete from public.%I where pk in (select pk from public.%I where %s order by pk %s)',
    p_coll, p_coll, public.mq_where(p_filter), case when p_multi then '' else 'limit 1' end);
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- Stok total produk = jumlah stok semua gudang dalam satuan (otomatis)
-- ---------------------------------------------------------------------
create or replace function public.recalc_product_stock(p_product_id text) returns void
language plpgsql security definer set search_path = public as $$
declare total numeric;
begin
  if p_product_id is null or p_product_id = '' then return; end if;
  select coalesce(sum(
           (case when jsonb_typeof(ws.doc->'stock') = 'number' then (ws.doc->>'stock')::numeric else 0 end) *
           (case when w.doc->>'unit' = 'dus'
                 then coalesce(nullif((p.doc->>'items_per_box')::numeric, 0), 1) else 1 end)), 0)
    into total
    from public.warehouse_stock ws
    join public.products p on p.doc->>'id' = p_product_id
    left join public.warehouses w on w.doc->>'id' = ws.doc->>'warehouse_id'
   where ws.doc->>'product_id' = p_product_id
     and coalesce(ws.doc->>'warehouse_id', '') not like 'vehicle:%';
  update public.products set doc = jsonb_set(doc, '{stock}', to_jsonb(total))
   where doc->>'id' = p_product_id and (doc->'stock') is distinct from to_jsonb(total);
end $$;

create or replace function public.trg_ws_recalc() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE','DELETE') then perform public.recalc_product_stock(old.doc->>'product_id'); end if;
  if tg_op in ('INSERT','UPDATE') and (tg_op = 'INSERT' or new.doc->>'product_id' is distinct from old.doc->>'product_id'
      or new.doc->'stock' is distinct from old.doc->'stock') then
    perform public.recalc_product_stock(new.doc->>'product_id');
  end if;
  return null;
end $$;
drop trigger if exists ws_recalc on public.warehouse_stock;
create trigger ws_recalc after insert or update or delete on public.warehouse_stock
  for each row execute function public.trg_ws_recalc();

create or replace function public.trg_product_ipb() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.doc->'items_per_box' is distinct from old.doc->'items_per_box' then
    perform public.recalc_product_stock(new.doc->>'id');
  end if;
  return null;
end $$;
drop trigger if exists product_ipb on public.products;
create trigger product_ipb after insert or update on public.products
  for each row execute function public.trg_product_ipb();

-- ---------------------------------------------------------------------
-- Akun pengguna (dipanggil dari halaman Pengguna / Profil)
-- ---------------------------------------------------------------------
create or replace function public.admin_create_user(
  p_email text, p_password text, p_name text, p_role text, p_canvasser_id text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions, auth as $$
declare uid uuid := gen_random_uuid(); em text := lower(trim(p_email));
begin
  if public.app_role() is distinct from 'admin' then raise exception 'Hanya admin yang dapat menambah pengguna'; end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'Password minimal 6 karakter'; end if;
  if exists (select 1 from auth.users where lower(email) = em) then raise exception 'Email sudah terdaftar'; end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', em,
    crypt(p_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('name', p_name), now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text,
    jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true), 'email', now(), now(), now());
  insert into public.profiles (id, email, name, role, canvasser_id) values (uid, em, p_name, p_role, nullif(p_canvasser_id, ''));
  return jsonb_build_object('id', uid, 'email', em, 'name', p_name, 'role', p_role,
    'canvasser_id', nullif(p_canvasser_id, ''), 'created_at', now());
end $$;

create or replace function public.admin_update_user(
  p_id uuid, p_name text default null, p_role text default null, p_password text default null,
  p_canvasser_id text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if public.app_role() is distinct from 'admin' then raise exception 'Hanya admin yang dapat mengubah pengguna'; end if;
  update public.profiles set
    name = coalesce(p_name, name), role = coalesce(p_role, role),
    canvasser_id = case when p_canvasser_id is null then canvasser_id else nullif(p_canvasser_id, '') end
   where id = p_id;
  if coalesce(p_password, '') <> '' then
    update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() where id = p_id;
  end if;
  return (select to_jsonb(p) from public.profiles p where id = p_id);
end $$;

create or replace function public.admin_delete_user(p_id uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if public.app_role() is distinct from 'admin' then raise exception 'Hanya admin yang dapat menghapus pengguna'; end if;
  if p_id = auth.uid() then raise exception 'Tidak bisa menghapus akun sendiri'; end if;
  delete from auth.users where id = p_id;
end $$;

create or replace function public.update_my_profile(
  p_name text default null, p_email text default null,
  p_current_password text default null, p_new_password text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions, auth as $$
declare me uuid := auth.uid(); em text := lower(trim(p_email));
begin
  if me is null then raise exception 'Belum login'; end if;
  if coalesce(p_new_password, '') <> '' then
    if coalesce(p_current_password, '') = '' then raise exception 'Password saat ini wajib diisi'; end if;
    if not exists (select 1 from auth.users where id = me and encrypted_password = crypt(p_current_password, encrypted_password)) then
      raise exception 'Password saat ini salah';
    end if;
    update auth.users set encrypted_password = crypt(p_new_password, gen_salt('bf')), updated_at = now() where id = me;
  end if;
  if coalesce(em, '') <> '' then
    if exists (select 1 from auth.users where lower(email) = em and id <> me) then raise exception 'Email sudah dipakai'; end if;
    update auth.users set email = em, updated_at = now() where id = me;
    update auth.identities set identity_data = identity_data || jsonb_build_object('email', em) where user_id = me and provider = 'email';
    update public.profiles set email = em where id = me;
  end if;
  if coalesce(p_name, '') <> '' then update public.profiles set name = p_name where id = me; end if;
  return (select to_jsonb(p) from public.profiles p where id = me);
end $$;

-- Membuat admin pertama. Hanya bisa dipakai selama belum ada admin.
-- Contoh: select public.bootstrap_admin('admin@tokoanda.com', 'password-kuat-anda', 'Administrator');
create or replace function public.bootstrap_admin(p_email text, p_password text, p_name text default 'Administrator')
returns text language plpgsql security definer set search_path = public, extensions, auth as $$
declare uid uuid := gen_random_uuid(); em text := lower(trim(p_email));
begin
  if exists (select 1 from public.profiles where role = 'admin') then
    raise exception 'Admin sudah ada. Tambah pengguna lain dari halaman Pengguna.';
  end if;
  if length(coalesce(p_password, '')) < 8 then raise exception 'Password minimal 8 karakter'; end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', em,
    crypt(p_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('name', p_name), now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text,
    jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true), 'email', now(), now(), now());
  insert into public.profiles (id, email, name, role) values (uid, em, p_name, 'admin');
  return 'Admin dibuat: ' || em;
end $$;
revoke execute on function public.bootstrap_admin(text, text, text) from anon, authenticated, public;

-- ---------------------------------------------------------------------
-- Gudang bawaan
-- ---------------------------------------------------------------------
insert into public.warehouses(doc)
select x.doc from (values
  ('{"id":"gudang_utama","name":"Gudang Utama","unit":"dus","sort_order":1}'::jsonb),
  ('{"id":"gudang_toko","name":"Gudang Toko","unit":"satuan","sort_order":2}'::jsonb),
  ('{"id":"gudang_lainnya","name":"Gudang Lainnya","unit":"dus","sort_order":3}'::jsonb)) x(doc)
where not exists (select 1 from public.warehouses w where w.doc->>'id' = x.doc->>'id');

-- ---------------------------------------------------------------------
-- Penyimpanan foto produk (Supabase Storage, gratis 1 GB)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;
drop policy if exists product_images_write on storage.objects;
create policy product_images_write on storage.objects for all to authenticated
  using (bucket_id = 'product-images' and public.app_role() in ('admin','manager','office_staff'))
  with check (bucket_id = 'product-images' and public.app_role() in ('admin','manager','office_staff'));

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.bootstrap_admin(text, text, text) from anon, authenticated, public;
