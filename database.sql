-- DATABASE TASKPRO (instalasi BARU). Jalankan sekali di Supabase > SQL Editor.
-- Jika Anda sudah menjalankan 01_schema.sql dan 02_migration.sql, JANGAN jalankan file ini lagi.
-- TaskPro Fase 1: skema dasar. Jalankan di Supabase > SQL Editor.

create type user_role as enum ('mdm', 'rmdm', 'mds', 'tl', 'kormot', 'frontliner');

-- Cabang. Satu cabang hanya punya satu MDS (mds_id); satu MDS boleh pegang beberapa cabang.
create table cabang (
  id uuid primary key default gen_random_uuid(),
  kode text not null unique check (kode ~ '^[0-9]{4}$'),   -- contoh: 0300
  nama text not null,
  alamat text not null,
  mds_id uuid,                                              -- diisi setelah profiles ada
  outlet_seq int not null default 0                         -- counter kode outlet otomatis
);

-- Profil user. user_id contoh: 0300-TMTB01. Login memakai user_id, bukan email.
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  user_id text not null unique,
  nama text not null,
  role user_role not null,
  cabang_id uuid references cabang(id),                     -- untuk tl, kormot, frontliner
  atasan_id uuid references profiles(id) on delete restrict, -- khusus frontliner: satu atasan (TL/Kormot)
  created_at timestamptz not null default now(),
  check (role not in ('tl','kormot','frontliner') or cabang_id is not null),
  check ((role = 'frontliner') = (atasan_id is not null))
);
alter table cabang add foreign key (mds_id) references profiles(id) on delete set null;

create table outlets (
  id bigint generated always as identity (start with 1000000) primary key,
  code text unique,                                         -- dibuat otomatis oleh trigger
  cabang_id uuid not null references cabang(id),
  rayon smallint check (rayon between 1 and 24),            -- cycle kunjungan
  name text not null,
  address text not null,
  lat double precision not null,
  long double precision not null,
  outlet_category_id int not null,
  outlet_account_id int not null,
  province_name text, city_name text, owner text, phone text, -- boleh kosong utk data lama; form web tetap mewajibkan
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- Kode outlet otomatis: <kode cabang>-<urutan 7 digit>, contoh 0300-0000001
create function set_outlet_code() returns trigger language plpgsql as $$
declare k text; n int;
begin
  if new.code is null then
    update cabang set outlet_seq = outlet_seq + 1 where id = new.cabang_id
      returning kode, outlet_seq into k, n;
    new.code := k || '-' || lpad(n::text, 7, '0');
  end if;
  return new;
end $$;
create trigger trg_outlet_code before insert on outlets
  for each row execute function set_outlet_code();

-- Setting global. Radius tetap 50 m; MDM hanya menyalakan/mematikan.
create table settings (key text primary key, value jsonb not null);
insert into settings values ('radius_enforced', 'true'::jsonb);

-- Helper untuk aturan akses
create function my_role() returns user_role language sql stable security definer set search_path = public
  as $$ select role from profiles where id = auth.uid() $$;
create function my_cabang_ids() returns setof uuid language sql stable security definer set search_path = public
  as $$ select cabang_id from profiles where id = auth.uid() and cabang_id is not null
        union select id from cabang where mds_id = auth.uid() $$;

alter table cabang   enable row level security;
alter table profiles enable row level security;
alter table outlets  enable row level security;
alter table settings enable row level security;

create policy cabang_read   on cabang for select using (my_role() in ('mdm','rmdm') or id in (select my_cabang_ids()));
create policy cabang_write  on cabang for all    using (my_role() in ('mdm','rmdm')) with check (my_role() in ('mdm','rmdm'));

create policy profiles_self on profiles for select using (id = auth.uid());
-- MDM/RMDM: semua. MDS: semua di cabangnya. TL/Kormot: hanya bawahannya.
create policy profiles_read on profiles for select using (
  my_role() in ('mdm','rmdm')
  or atasan_id = auth.uid()
  or (my_role() = 'mds' and cabang_id in (select my_cabang_ids())));
-- Membuat/menghapus akun dilakukan lewat server (service role) setelah cek role di aplikasi.
-- Aplikasi juga harus memastikan atasan_id menunjuk ke user ber-role tl/kormot di cabang yang sama.

create policy outlets_read  on outlets for select using (my_role() in ('mdm','rmdm') or cabang_id in (select my_cabang_ids()));
create policy outlets_write on outlets for all    using (my_role() in ('mdm','rmdm') or cabang_id in (select my_cabang_ids()))
                                                with check (my_role() in ('mdm','rmdm') or cabang_id in (select my_cabang_ids()));

create policy settings_read  on settings for select using (auth.uid() is not null);
create policy settings_write on settings for update using (my_role() = 'mdm') with check (my_role() = 'mdm');

-- Daftar cabang yang masih kosong (untuk dropdown "tambah cabang ke MDS")
create view cabang_tanpa_mds as select * from cabang where mds_id is null;

-- Migrasi 02: menyesuaikan tabel outlets dengan format DMP. Jalankan sekali di SQL Editor.
alter table outlets drop column outlet_category_id, drop column outlet_account_id;
alter table outlets
  add column category text, add column account text,       -- teks: General Trade, Warung Kopi, dst
  add column ext_id text,                                   -- ID acak dari sumber (kolom "code outlet" di DMP)
  add column kode_md text,                                  -- pemilik outlet = User ID frontliner, mis. 0300-TMTB01
  add column cycle text, add column district text, add column profile_outlet text,
  add column status text not null default 'AKTIF',
  add unique (cabang_id, ext_id);                           -- upload ulang tidak menggandakan
alter table outlets alter column lat drop not null, alter column long drop not null; -- boleh belum ada lokasi
create index on outlets (cabang_id, kode_md, rayon);
-- Migrasi 03: RMDM hanya melihat cabang yang dia cover. Jalankan sekali di SQL Editor.
alter table cabang add column rmdm_id uuid references profiles(id) on delete set null;

create or replace function my_cabang_ids() returns setof uuid language sql stable security definer set search_path = public
  as $$ select cabang_id from profiles where id = auth.uid() and cabang_id is not null
        union select id from cabang where mds_id = auth.uid() or rmdm_id = auth.uid() $$;

drop policy cabang_read on cabang;  drop policy cabang_write on cabang;
drop policy profiles_read on profiles;
drop policy outlets_read on outlets; drop policy outlets_write on outlets;

create policy cabang_read  on cabang for select using (my_role() = 'mdm' or id in (select my_cabang_ids()));
create policy cabang_write on cabang for all
  using      (my_role() = 'mdm' or (my_role() = 'rmdm' and rmdm_id = auth.uid()))
  with check (my_role() = 'mdm' or (my_role() = 'rmdm' and rmdm_id = auth.uid()));

-- MDM: semua. RMDM/MDS: akun di cabang yang dicover. RMDM juga melihat semua MDS (untuk memegangkan cabang).
create policy profiles_read on profiles for select using (
  my_role() = 'mdm'
  or atasan_id = auth.uid()
  or (my_role() in ('mds','rmdm') and cabang_id in (select my_cabang_ids()))
  or (my_role() = 'rmdm' and role = 'mds'));

create policy outlets_read  on outlets for select using (my_role() = 'mdm' or cabang_id in (select my_cabang_ids()));
create policy outlets_write on outlets for all using (my_role() = 'mdm' or cabang_id in (select my_cabang_ids()))
                                       with check (my_role() = 'mdm' or cabang_id in (select my_cabang_ids()));
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
-- Migrasi 05: hak edit outlet untuk frontliner (hanya outlet miliknya) dan akses kunjungan untuk TL/Kormot. Jalankan sekali.
drop policy outlets_write on outlets;
create policy outlets_write on outlets for all
  using (my_role() = 'mdm'
      or (my_role() in ('mds','rmdm','tl','kormot') and cabang_id in (select my_cabang_ids()))
      or (my_role() = 'frontliner' and kode_md = (select user_id from profiles where id = auth.uid())))
  with check (my_role() = 'mdm'
      or (my_role() in ('mds','rmdm','tl','kormot') and cabang_id in (select my_cabang_ids()))
      or (my_role() = 'frontliner' and kode_md = (select user_id from profiles where id = auth.uid())));

drop policy visits_read on visits;
create policy visits_read on visits for select using (
  frontliner_id = auth.uid() or my_role() = 'mdm'
  or (my_role() in ('mds','rmdm') and cabang_id in (select my_cabang_ids()))
  or frontliner_id in (select id from profiles where atasan_id = auth.uid()));   -- TL/Kormot: bawahannya
