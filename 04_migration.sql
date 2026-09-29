-- Migrasi 04: produk, kunjungan (check-in/out), penjualan, aturan radius 50 m. Jalankan sekali.
create table products (
  id uuid primary key default gen_random_uuid(),
  product text not null unique, sku_code text, brand text, category_product text,
  price numeric not null check (price >= 0),
  is_focus boolean not null default false,      -- produk fokus (dipakai untuk EC di Rekap)
  active boolean not null default true);
insert into products (product, sku_code, brand, category_product, price) values
  ('MAC RTD', 'ABC SUSU', 'ABC RTD', 'RTD COFFEE', 3300),
  ('MGC RTD', 'ALL VARIANT', 'GOODDAY RTD', 'RTD COFFEE', 5300),
  ('MKC RTD', 'ALL VARIANT', 'KAPAL API RTD', 'RTD COFFEE', 4400);

create table visits (
  id uuid primary key default gen_random_uuid(),
  outlet_id bigint not null references outlets(id),
  frontliner_id uuid not null references profiles(id),
  cabang_id uuid not null references cabang(id),
  checkin_at timestamptz not null default now(),
  checkin_lat double precision, checkin_lng double precision,
  checkout_at timestamptz,
  effective boolean not null default false);      -- Effective Call = ada penjualan
create unique index one_open_visit on visits (frontliner_id) where checkout_at is null;
create index on visits (cabang_id, checkin_at);

create table sales (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  product_id uuid not null references products(id),
  qty int not null check (qty > 0), price numeric not null,
  value numeric generated always as (qty * price) stored);

alter table products enable row level security;
alter table visits   enable row level security;
alter table sales    enable row level security;
create policy products_read  on products for select using (auth.uid() is not null);
create policy products_write on products for all using (my_role() in ('mdm','rmdm','mds')) with check (my_role() in ('mdm','rmdm','mds'));
create policy visits_read on visits for select using (
  frontliner_id = auth.uid() or my_role() = 'mdm' or (my_role() in ('mds','rmdm') and cabang_id in (select my_cabang_ids())));
create policy sales_read on sales for select using (visit_id in (select id from visits));
-- Tidak ada policy tulis untuk visits/sales: frontliner menulis hanya lewat fungsi di bawah.

create function jarak_m(a1 float8, b1 float8, a2 float8, b2 float8) returns float8 language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(sin(radians(a2 - a1) / 2) ^ 2 + cos(radians(a1)) * cos(radians(a2)) * sin(radians(b2 - b1) / 2) ^ 2)) $$;

-- Radius 50 m (toleransi akurasi GPS maksimal 30 m). Hanya berlaku jika setting radius_enforced = true.
create function cek_radius(p_outlet bigint, p_lat float8, p_lng float8, p_acc float8) returns void
language plpgsql security definer set search_path = public as $$
declare o outlets; on_ boolean; d float8;
begin
  select (value #>> '{}')::boolean into on_ from settings where key = 'radius_enforced';
  if not coalesce(on_, true) then return; end if;
  select * into o from outlets where id = p_outlet;
  if o.lat is null then raise exception 'Lokasi outlet belum ada. Minta MDS melengkapi koordinat outlet.'; end if;
  if p_lat is null then raise exception 'Lokasi Anda tidak terbaca.'; end if;
  d := jarak_m(p_lat, p_lng, o.lat, o.long);
  if d - least(coalesce(p_acc, 0), 30) > 50 then raise exception 'Anda % m dari outlet. Maksimal 50 m.', round(d); end if;
end $$;

create function checkin(p_outlet bigint, p_lat float8, p_lng float8, p_acc float8) returns uuid
language plpgsql security definer set search_path = public as $$
declare me profiles; v uuid;
begin
  select * into me from profiles where id = auth.uid();
  if me.role is distinct from 'frontliner' then raise exception 'Hanya frontliner yang bisa check-in.'; end if;
  perform 1 from outlets where id = p_outlet and kode_md = me.user_id;
  if not found then raise exception 'Outlet ini bukan milik Anda.'; end if;
  perform cek_radius(p_outlet, p_lat, p_lng, p_acc);
  insert into visits (outlet_id, frontliner_id, cabang_id, checkin_lat, checkin_lng)
    values (p_outlet, me.id, me.cabang_id, p_lat, p_lng) returning id into v;
  return v;
exception when unique_violation then raise exception 'Masih ada kunjungan yang belum check-out.';
end $$;

create function save_sales(p_visit uuid, p_items jsonb, p_lat float8, p_lng float8, p_acc float8) returns void
language plpgsql security definer set search_path = public as $$
declare v visits; it jsonb; p products;
begin
  select * into v from visits where id = p_visit and frontliner_id = auth.uid() and checkout_at is null;
  if not found then raise exception 'Kunjungan tidak aktif.'; end if;
  perform cek_radius(v.outlet_id, p_lat, p_lng, p_acc);
  delete from sales where visit_id = p_visit;
  for it in select * from jsonb_array_elements(p_items) loop
    if (it ->> 'qty')::int > 0 then
      select * into p from products where id = (it ->> 'product_id')::uuid and active;
      if found then insert into sales (visit_id, product_id, qty, price) values (p_visit, p.id, (it ->> 'qty')::int, p.price); end if;
    end if;
  end loop;
end $$;

create function checkout(p_visit uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update visits set checkout_at = now(), effective = exists (select 1 from sales where visit_id = p_visit)
    where id = p_visit and frontliner_id = auth.uid() and checkout_at is null;
  if not found then raise exception 'Kunjungan tidak aktif.'; end if;
end $$;
