-- DATABASE TASKPRO (instalasi BARU). Jalankan sekali di Supabase > SQL Editor.
-- Jika Anda sudah menjalankan 01_schema.sql dan 02_migration.sql, JANGAN jalankan file ini lagi.
-- TaskPro Fase 1: skema dasar. Jalankan di Supabase > SQL Editor.

create type user_role as enum ('mdm', 'rmdm', 'mds', 'tl', 'kormot', 'frontliner');

-- Cabang. Satu cabang hanya punya satu MDS (mds_id) dan satu MDS hanya memegang satu cabang (lihat migrasi 08). RMDM boleh mencover banyak cabang.
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
-- Migrasi 06: Outlet ID acak 9 digit, kode outlet baru (cabang-kodeMD-urutan9), kolom kelurahan,
-- pengecualian GPS per frontliner, dan daftar Kode MD. Jalankan sekali di SQL Editor.
alter table outlets  add column village text;
alter table profiles add column gps_required boolean not null default true;   -- false = dikecualikan dari GPS wajib dan batas 50 m

create table md_seq (kode_md text primary key, seq int not null default 0);   -- urutan pendaftaran outlet per Kode MD
alter table md_seq enable row level security;                                  -- tanpa policy: hanya trigger yang menulis

create or replace function set_outlet_code() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text; n int; c text;
begin
  if new.ext_id is null then                       -- Outlet ID: 9 angka acak, dijamin belum dipakai
    loop
      c := (100000000 + floor(random() * 900000000))::bigint::text;
      exit when not exists (select 1 from outlets where ext_id = c);
    end loop;
    new.ext_id := c;
  end if;
  if new.code is null then
    select kode into k from cabang where id = new.cabang_id;
    if new.kode_md is not null then                -- contoh: 0300-TMTB01-000000001
      insert into md_seq values (new.kode_md, 1)
        on conflict (kode_md) do update set seq = md_seq.seq + 1 returning seq into n;
      new.code := k || '-' || split_part(new.kode_md, '-', 2) || '-' || lpad(n::text, 9, '0');
    else
      update cabang set outlet_seq = outlet_seq + 1 where id = new.cabang_id returning outlet_seq into n;
      new.code := k || '-' || lpad(n::text, 7, '0');
    end if;
  end if;
  return new;
end $$;

create function kode_md_list() returns setof text language sql stable as $$
  select distinct kode_md from outlets where kode_md is not null order by 1 $$;   -- mengikuti RLS: hanya cabang akun itu

create or replace function cek_radius(p_outlet bigint, p_lat float8, p_lng float8, p_acc float8) returns void
language plpgsql security definer set search_path = public as $$
declare o outlets; on_ boolean; d float8; req boolean;
begin
  select gps_required into req from profiles where id = auth.uid();
  if req is false then return; end if;             -- frontliner yang dikecualikan MDM
  select (value #>> '{}')::boolean into on_ from settings where key = 'radius_enforced';
  if not coalesce(on_, true) then return; end if;
  select * into o from outlets where id = p_outlet;
  if o.lat is null then raise exception 'Lokasi outlet belum ada. Minta MDS melengkapi koordinat outlet.'; end if;
  if p_lat is null then raise exception 'Lokasi Anda tidak terbaca.'; end if;
  d := jarak_m(p_lat, p_lng, o.lat, o.long);
  if d - least(coalesce(p_acc, 0), 30) > 50 then raise exception 'Anda % m dari outlet. Maksimal 50 m.', round(d); end if;
end $$;
-- Migrasi 07: Outlet ID = 9 angka acak untuk SEMUA outlet. ID asal DMP dipindah ke src_id
-- (hanya untuk mencegah duplikat saat import ulang). Jalankan sekali.
alter table outlets add column src_id text;
update outlets set src_id = ext_id where ext_id is not null and ext_id !~ '^[0-9]{9}$';

create index outlets_ext_id_idx on outlets (ext_id);          -- mempercepat pengecekan saat membuat ID
do $$
declare r record; c text;
begin
  for r in select id from outlets where ext_id is null or ext_id !~ '^[0-9]{9}$' loop
    loop
      c := (100000000 + floor(random() * 900000000))::bigint::text;
      exit when not exists (select 1 from outlets where ext_id = c);
    end loop;
    update outlets set ext_id = c where id = r.id;
  end loop;
end $$;
drop index outlets_ext_id_idx;

create unique index outlets_ext_id_uq on outlets (ext_id);    -- Outlet ID tidak mungkin sama
alter table outlets add unique (cabang_id, src_id);           -- import ulang tidak menggandakan outlet

-- Migrasi 08: (1) MDS hanya boleh memegang 1 cabang, RMDM tetap boleh banyak cabang.
--             (2) Sesi perangkat: penanda akun aktif, login 1 perangkat untuk frontliner, logout paksa. Jalankan sekali.

-- (1) Jika ada MDS yang sudah memegang lebih dari 1 cabang, hanya cabang dengan kode terkecil yang dipertahankan;
--     cabang lainnya dikosongkan dan bisa diberikan ke MDS lain lewat menu MDS & RMDM.
update cabang c set mds_id = null
 where mds_id is not null
   and id <> (select c2.id from cabang c2 where c2.mds_id = c.mds_id order by c2.kode limit 1);
create unique index if not exists cabang_mds_uq on cabang (mds_id) where mds_id is not null;

-- (2) Satu baris per perangkat yang sedang login. last_seen diperbarui tiap ~45 detik saat aplikasi terbuka.
create table if not exists device_sessions (
  user_id uuid not null references profiles(id) on delete cascade,
  device_id text not null,
  ua text,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, device_id));
alter table device_sessions enable row level security;
-- Membaca: sesi milik sendiri dan akun yang boleh dilihat (mengikuti aturan tabel profiles). Menulis hanya lewat fungsi.
drop policy if exists sesi_read on device_sessions;
create policy sesi_read on device_sessions for select using (user_id in (select id from profiles));

-- Daftarkan perangkat. Frontliner ditolak jika ada perangkat lain yang aktif dalam 10 menit terakhir
-- (ubah 'interval 10 minutes' di sini DAN AKTIF_MENIT di lib/sesi.ts bila ingin mengganti).
create or replace function sesi_klaim(p_device text, p_ua text default null) returns void
language plpgsql security definer set search_path = public as $$
declare me profiles;
begin
  select * into me from profiles where id = auth.uid();
  if not found then raise exception 'Akun tidak ditemukan'; end if;
  if me.role = 'frontliner' then
    if exists (select 1 from device_sessions where user_id = me.id and device_id <> p_device and last_seen > now() - interval '10 minutes') then
      raise exception 'AKUN_AKTIF';
    end if;
    delete from device_sessions where user_id = me.id and device_id <> p_device;
  end if;
  insert into device_sessions (user_id, device_id, ua) values (me.id, p_device, p_ua)
    on conflict (user_id, device_id) do update set last_seen = now(), ua = excluded.ua;
end $$;

-- Denyut: true = sesi masih sah; false = sudah diakhiri (login di perangkat lain / logout paksa).
create or replace function sesi_detak(p_device text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update device_sessions set last_seen = now() where user_id = auth.uid() and device_id = p_device;
  return found;
end $$;

create or replace function sesi_lepas(p_device text) returns void
language plpgsql security definer set search_path = public as $$
begin delete from device_sessions where user_id = auth.uid() and device_id = p_device; end $$;

-- Logout paksa. Hanya dipanggil server (service role) setelah cek wewenang.
create or replace function sesi_paksa(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from device_sessions where user_id = p_user;
  begin delete from auth.sessions where user_id = p_user;   -- mencabut refresh token; abaikan jika tidak diizinkan
  exception when others then null; end;
end $$;
revoke execute on function sesi_paksa(uuid) from public, anon, authenticated;
-- Migrasi 09: (A) fungsi internal tidak bisa dipanggil dari luar, (B) frontliner hanya membaca outlet miliknya,
-- (C) stok pembawaan harian: penjualan tidak boleh melebihi stok yang dibawa hari itu. Jalankan sekali.

-- (A) Hak eksekusi: fungsi kunjungan/sesi hanya untuk user yang sudah login; cek_radius hanya dipakai internal.
revoke execute on function cek_radius(bigint, float8, float8, float8) from public, anon, authenticated;
revoke execute on function checkin(bigint, float8, float8, float8) from public, anon;
revoke execute on function checkout(uuid) from public, anon;
revoke execute on function sesi_klaim(text, text) from public, anon;
revoke execute on function sesi_detak(text) from public, anon;
revoke execute on function sesi_lepas(text) from public, anon;
grant execute on function checkin(bigint, float8, float8, float8), checkout(uuid),
  sesi_klaim(text, text), sesi_detak(text), sesi_lepas(text) to authenticated;

-- (B) Frontliner hanya membaca outlet dengan Kode MD miliknya (sebelumnya seluruh cabang, termasuk nama pemilik dan no. HP).
drop policy if exists outlets_read on outlets;
create policy outlets_read on outlets for select using (
  (select my_role()) = 'mdm'
  or ((select my_role()) in ('mds', 'rmdm', 'tl', 'kormot') and cabang_id in (select my_cabang_ids()))
  or ((select my_role()) = 'frontliner' and kode_md = (select user_id from profiles where id = auth.uid())));

-- (C) Stok pembawaan. Tanggal memakai WIB. Tulis hanya lewat fungsi; frontliner tidak bisa mengubah tabel langsung.
insert into settings values ('stok_enforced', 'true'::jsonb) on conflict (key) do nothing;   -- MDM bisa mematikan dari halaman Home

create table if not exists carry_stock (
  id uuid primary key default gen_random_uuid(),
  frontliner_id uuid not null references profiles(id) on delete cascade,
  stock_date date not null,
  product_id uuid not null references products(id),
  qty int not null check (qty >= 0),
  updated_at timestamptz not null default now(),
  unique (frontliner_id, stock_date, product_id));
alter table carry_stock enable row level security;
drop policy if exists stok_read on carry_stock;
create policy stok_read on carry_stock for select using (frontliner_id in (select id from profiles));

create or replace function stok_hari_ini(p_exclude uuid default null) returns table (product_id uuid, dibawa int, terjual int)
language sql stable security definer set search_path = public as $$
  with d as (select (now() at time zone 'Asia/Jakarta')::date as d),
  c as (select cs.product_id, sum(cs.qty)::int as q from carry_stock cs, d
        where cs.frontliner_id = auth.uid() and cs.stock_date = d.d group by 1),
  s as (select sl.product_id, sum(sl.qty)::int as q from sales sl join visits v on v.id = sl.visit_id, d
        where v.frontliner_id = auth.uid() and (v.checkin_at at time zone 'Asia/Jakarta')::date = d.d
          and (p_exclude is null or v.id <> p_exclude) group by 1)
  select coalesce(c.product_id, s.product_id), coalesce(c.q, 0), coalesce(s.q, 0) from c full join s on s.product_id = c.product_id $$;

-- Tambahkan stok yang dibawa hari ini (kumulatif; boleh berkali-kali, mis. isi ulang siang hari).
create or replace function stok_tambah(p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare me profiles; it jsonb; q int; pid uuid; d date := (now() at time zone 'Asia/Jakarta')::date;
begin
  select * into me from profiles where id = auth.uid();
  if me.role is distinct from 'frontliner' then raise exception 'Hanya frontliner yang mengisi stok pembawaan.'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    q := (it ->> 'qty')::int; pid := (it ->> 'product_id')::uuid;
    if q is null or q <= 0 then continue; end if;
    if q > 100000 then raise exception 'Jumlah stok tidak wajar.'; end if;
    perform 1 from products where id = pid and active; if not found then continue; end if;
    insert into carry_stock (frontliner_id, stock_date, product_id, qty) values (me.id, d, pid, q)
      on conflict (frontliner_id, stock_date, product_id) do update set qty = carry_stock.qty + excluded.qty, updated_at = now();
  end loop;
end $$;

-- Koreksi total stok satu produk hari ini (salah ketik). Tidak boleh di bawah jumlah yang sudah terjual.
create or replace function stok_koreksi(p_product uuid, p_total int) returns void
language plpgsql security definer set search_path = public as $$
declare me profiles; sold int; d date := (now() at time zone 'Asia/Jakarta')::date;
begin
  select * into me from profiles where id = auth.uid();
  if me.role is distinct from 'frontliner' then raise exception 'Hanya frontliner yang mengisi stok pembawaan.'; end if;
  if p_total is null or p_total < 0 or p_total > 100000 then raise exception 'Jumlah stok tidak valid.'; end if;
  select coalesce(sum(s.qty), 0) into sold from sales s join visits v on v.id = s.visit_id
    where v.frontliner_id = me.id and (v.checkin_at at time zone 'Asia/Jakarta')::date = d and s.product_id = p_product;
  if p_total < sold then raise exception 'Stok tidak boleh kurang dari yang sudah terjual (% pcs).', sold; end if;
  insert into carry_stock (frontliner_id, stock_date, product_id, qty) values (me.id, d, p_product, p_total)
    on conflict (frontliner_id, stock_date, product_id) do update set qty = excluded.qty, updated_at = now();
end $$;

-- Penjualan tidak boleh melebihi stok pembawaan pada tanggal kunjungan (kecuali MDM mematikan aturan ini).
create or replace function save_sales(p_visit uuid, p_items jsonb, p_lat float8, p_lng float8, p_acc float8) returns void
language plpgsql security definer set search_path = public as $$
declare v visits; it jsonb; p products; on_ boolean; d date; carried int; sold int; q int;
begin
  select * into v from visits where id = p_visit and frontliner_id = auth.uid() and checkout_at is null;
  if not found then raise exception 'Kunjungan tidak aktif.'; end if;
  perform cek_radius(v.outlet_id, p_lat, p_lng, p_acc);
  select coalesce((value #>> '{}')::boolean, true) into on_ from settings where key = 'stok_enforced';
  d := (v.checkin_at at time zone 'Asia/Jakarta')::date;
  delete from sales where visit_id = p_visit;          -- seluruh fungsi satu transaksi: jika stok kurang, penjualan lama tetap utuh
  for it in select * from jsonb_array_elements(p_items) loop
    q := (it ->> 'qty')::int;
    if q > 0 then
      select * into p from products where id = (it ->> 'product_id')::uuid and active;
      if found then
        if coalesce(on_, true) then
          select coalesce(sum(qty), 0) into carried from carry_stock
            where frontliner_id = v.frontliner_id and stock_date = d and product_id = p.id;
          select coalesce(sum(s.qty), 0) into sold from sales s join visits x on x.id = s.visit_id
            where x.frontliner_id = v.frontliner_id and (x.checkin_at at time zone 'Asia/Jakarta')::date = d and s.product_id = p.id;
          if sold + q > carried then
            raise exception 'Stok % tidak cukup. Sisa % pcs, diminta % pcs.', p.product, greatest(carried - sold, 0), q;
          end if;
        end if;
        insert into sales (visit_id, product_id, qty, price) values (p_visit, p.id, q, p.price);
      end if;
    end if;
  end loop;
end $$;

revoke execute on function stok_hari_ini(uuid), stok_tambah(jsonb), stok_koreksi(uuid, int), save_sales(uuid, jsonb, float8, float8, float8) from public, anon;
grant execute on function stok_hari_ini(uuid), stok_tambah(jsonb), stok_koreksi(uuid, int), save_sales(uuid, jsonb, float8, float8, float8) to authenticated;
-- Migrasi 10: Project. Nama project mengisi kolom "Project" di Excel (Kunjungan dan Selling). Jalankan sekali.
create table projects (
  id uuid primary key default gen_random_uuid(),
  cabang_id uuid not null references cabang(id),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (cabang_id, name));
alter table profiles add column project_id uuid references projects(id) on delete set null;   -- satu frontliner, satu project
alter table visits   add column project_id uuid references projects(id) on delete restrict;    -- project saat check-in: riwayat tidak berubah
alter table projects enable row level security;

create policy projects_read on projects for select using (
  (select my_role()) = 'mdm'
  or ((select my_role()) in ('mds', 'rmdm', 'tl', 'kormot') and cabang_id in (select my_cabang_ids())));
create policy projects_write on projects for all
  using      ((select my_role()) = 'mdm' or ((select my_role()) in ('mds', 'rmdm') and cabang_id in (select my_cabang_ids())))
  with check ((select my_role()) = 'mdm' or ((select my_role()) in ('mds', 'rmdm') and cabang_id in (select my_cabang_ids())));

-- Masukkan / keluarkan frontliner dari project (p_project null = keluarkan). Hanya cabang yang menjadi wewenang pemanggil.
create or replace function project_set_member(p_frontliner uuid, p_project uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r user_role; f profiles; pr projects;
begin
  select role into r from profiles where id = auth.uid();
  select * into f from profiles where id = p_frontliner;
  if f.role is distinct from 'frontliner' then raise exception 'Akun bukan frontliner.'; end if;
  if p_project is not null then
    select * into pr from projects where id = p_project;
    if not found then raise exception 'Project tidak ditemukan.'; end if;
    if pr.cabang_id <> f.cabang_id then raise exception 'Frontliner harus dari cabang yang sama dengan project.'; end if;
  end if;
  if r = 'mdm' then null;
  elsif r in ('mds', 'rmdm') and f.cabang_id in (select my_cabang_ids()) then null;
  else raise exception 'Anda tidak berwenang atas cabang ini.'; end if;
  update profiles set project_id = p_project where id = p_frontliner;
end $$;

-- checkin mencatat project frontliner saat itu
create or replace function checkin(p_outlet bigint, p_lat float8, p_lng float8, p_acc float8) returns uuid
language plpgsql security definer set search_path = public as $$
declare me profiles; v uuid;
begin
  select * into me from profiles where id = auth.uid();
  if me.role is distinct from 'frontliner' then raise exception 'Hanya frontliner yang bisa check-in.'; end if;
  perform 1 from outlets where id = p_outlet and kode_md = me.user_id;
  if not found then raise exception 'Outlet ini bukan milik Anda.'; end if;
  perform cek_radius(p_outlet, p_lat, p_lng, p_acc);
  insert into visits (outlet_id, frontliner_id, cabang_id, checkin_lat, checkin_lng, project_id)
    values (p_outlet, me.id, me.cabang_id, p_lat, p_lng, me.project_id) returning id into v;
  return v;
exception when unique_violation then raise exception 'Masih ada kunjungan yang belum check-out.';
end $$;

revoke execute on function project_set_member(uuid, uuid) from public, anon;
grant execute on function project_set_member(uuid, uuid) to authenticated;
-- Migrasi 11: produk fokus per project. Satu frontliner hanya di satu project, jadi produk fokusnya mengikuti project itu.
-- Status fokus dicatat pada tiap baris penjualan saat transaksi, sehingga perubahan fokus tidak mengubah riwayat. Jalankan sekali.
create table project_focus (
  project_id uuid not null references projects(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  primary key (project_id, product_id));
alter table project_focus enable row level security;
create policy pfocus_read on project_focus for select using (
  project_id in (select id from projects)                                              -- admin: project dalam wewenangnya
  or project_id = (select project_id from profiles where id = auth.uid()));            -- frontliner: project miliknya
create policy pfocus_write on project_focus for all
  using      ((select my_role()) in ('mdm', 'mds', 'rmdm') and project_id in (select id from projects))
  with check ((select my_role()) in ('mdm', 'mds', 'rmdm') and project_id in (select id from projects));

-- Peralihan: tanda fokus global lama disalin ke semua project yang sudah ada; riwayat penjualan dicap sesuai tanda lama.
insert into project_focus select pr.id, p.id from projects pr cross join products p where p.is_focus on conflict do nothing;
alter table sales add column is_focus boolean not null default false;
update sales s set is_focus = p.is_focus from products p where p.id = s.product_id;

create or replace function save_sales(p_visit uuid, p_items jsonb, p_lat float8, p_lng float8, p_acc float8) returns void
language plpgsql security definer set search_path = public as $$
declare v visits; it jsonb; p products; on_ boolean; d date; carried int; sold int; q int;
begin
  select * into v from visits where id = p_visit and frontliner_id = auth.uid() and checkout_at is null;
  if not found then raise exception 'Kunjungan tidak aktif.'; end if;
  perform cek_radius(v.outlet_id, p_lat, p_lng, p_acc);
  select coalesce((value #>> '{}')::boolean, true) into on_ from settings where key = 'stok_enforced';
  d := (v.checkin_at at time zone 'Asia/Jakarta')::date;
  delete from sales where visit_id = p_visit;          -- seluruh fungsi satu transaksi: jika stok kurang, penjualan lama tetap utuh
  for it in select * from jsonb_array_elements(p_items) loop
    q := (it ->> 'qty')::int;
    if q > 0 then
      select * into p from products where id = (it ->> 'product_id')::uuid and active;
      if found then
        if coalesce(on_, true) then
          select coalesce(sum(qty), 0) into carried from carry_stock
            where frontliner_id = v.frontliner_id and stock_date = d and product_id = p.id;
          select coalesce(sum(s.qty), 0) into sold from sales s join visits x on x.id = s.visit_id
            where x.frontliner_id = v.frontliner_id and (x.checkin_at at time zone 'Asia/Jakarta')::date = d and s.product_id = p.id;
          if sold + q > carried then
            raise exception 'Stok % tidak cukup. Sisa % pcs, diminta % pcs.', p.product, greatest(carried - sold, 0), q;
          end if;
        end if;
        insert into sales (visit_id, product_id, qty, price, is_focus) values (p_visit, p.id, q, p.price,
          exists (select 1 from project_focus pf where pf.project_id = v.project_id and pf.product_id = p.id));
      end if;
    end if;
  end loop;
end $$;

grant execute on function save_sales(uuid, jsonb, float8, float8, float8) to authenticated;
-- Migrasi 12: indeks, zona waktu per cabang, bukti lokasi check-in, jejak audit, pindah outlet massal, stok oleh MDS,
-- rekap di SQL, log error, cache alamat, dan pemantau kapasitas (dirancang untuk Supabase gratis: 500 MB). Jalankan sekali.

-- (A) Indeks untuk Rekap, stok, dan laporan
create index if not exists visits_fl_time_idx  on visits (frontliner_id, checkin_at);
create index if not exists visits_outlet_idx   on visits (outlet_id);
create index if not exists sales_visit_idx     on sales (visit_id);
create index if not exists sales_product_idx   on sales (product_id);
create index if not exists profiles_atasan_idx on profiles (atasan_id);
create index if not exists profiles_cabang_idx on profiles (cabang_id);

-- (B) Zona waktu per cabang (WIB/WITA/WIT): menentukan batas "hari" untuk stok, rekap, dan laporan
alter table cabang add column tz text not null default 'Asia/Jakarta' check (tz in ('Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'));
create function cabang_tz(p_cabang uuid) returns text language sql stable security definer set search_path = public as $$
  select coalesce((select tz from cabang where id = p_cabang), 'Asia/Jakarta') $$;
create function user_tz() returns text language sql stable security definer set search_path = public as $$
  select cabang_tz((select cabang_id from profiles where id = auth.uid())) $$;
revoke execute on function cabang_tz(uuid), user_tz() from public, anon;
grant execute on function cabang_tz(uuid), user_tz() to authenticated;

-- (C) Jejak audit. Volume dijaga kecil: outlet hanya UPDATE/DELETE (import massal tidak dicatat per baris), kunjungan dan penjualan tidak dicatat.
create table audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid, actor_user_id text,
  action text not null, tabel text, row_id text, detail jsonb);
create index audit_log_at_idx on audit_log (at desc);
alter table audit_log enable row level security;
create policy audit_read on audit_log for select using ((select my_role()) = 'mdm');

create function audit_row() returns trigger language plpgsql security definer set search_path = public as $$
declare act uuid := auth.uid(); au text; rid text; d jsonb; o jsonb; n jsonb;
begin
  if coalesce(current_setting('app.skip_audit', true), '') = '1' then return coalesce(new, old); end if;
  select user_id into au from profiles where id = act;
  if tg_op = 'DELETE' then o := to_jsonb(old); rid := coalesce(o ->> 'id', o ->> 'key', concat_ws('/', o ->> 'project_id', o ->> 'product_id')); d := jsonb_build_object('lama', o);
  elsif tg_op = 'INSERT' then n := to_jsonb(new); rid := coalesce(n ->> 'id', n ->> 'key', concat_ws('/', n ->> 'project_id', n ->> 'product_id')); d := jsonb_build_object('baru', n);
  else
    o := to_jsonb(old); n := to_jsonb(new); rid := coalesce(n ->> 'id', n ->> 'key');
    select jsonb_object_agg(k, jsonb_build_object('dari', o -> k, 'ke', n -> k)) into d
      from jsonb_object_keys(n) as k where (n -> k) is distinct from (o -> k) and k <> 'updated_at';
    if d is null then return new; end if;
  end if;
  insert into audit_log (actor, actor_user_id, action, tabel, row_id, detail) values (act, au, tg_op, tg_table_name, rid, d);
  return coalesce(new, old);
end $$;
create trigger audit_outlets      after update or delete on outlets       for each row execute function audit_row();
create trigger audit_projects     after insert or update or delete on projects      for each row execute function audit_row();
create trigger audit_pfocus       after insert or delete on project_focus for each row execute function audit_row();
create trigger audit_cabang       after insert or update or delete on cabang        for each row execute function audit_row();
create trigger audit_products     after insert or update or delete on products      for each row execute function audit_row();
create trigger audit_settings     after update on settings                for each row execute function audit_row();
create trigger audit_carry        after insert or update on carry_stock   for each row execute function audit_row();

-- (D) Bukti lokasi check-in + penanda kunjungan mencurigakan
alter table visits add column checkin_acc float8, add column checkin_dist float8,
  add column suspect boolean not null default false, add column suspect_reason text;
create index visits_suspect_idx on visits (checkin_at) where suspect;

create or replace function checkin(p_outlet bigint, p_lat float8, p_lng float8, p_acc float8) returns uuid
language plpgsql security definer set search_path = public as $$
declare me profiles; o outlets; prev visits; v uuid; d float8; km float8; jam float8; sus text;
begin
  select * into me from profiles where id = auth.uid();
  if me.role is distinct from 'frontliner' then raise exception 'Hanya frontliner yang bisa check-in.'; end if;
  select * into o from outlets where id = p_outlet and kode_md = me.user_id;
  if not found then raise exception 'Outlet ini bukan milik Anda.'; end if;
  perform cek_radius(p_outlet, p_lat, p_lng, p_acc);
  if p_lat is not null and o.lat is not null then d := jarak_m(p_lat, p_lng, o.lat, o.long); end if;
  if p_acc is not null and p_acc <= 0 then sus := 'Akurasi GPS 0 (kemungkinan lokasi palsu)'; end if;
  if p_lat is not null then                       -- perpindahan tidak wajar dari check-in sebelumnya
    select * into prev from visits where frontliner_id = me.id and checkin_lat is not null order by checkin_at desc limit 1;
    if found then
      km := jarak_m(prev.checkin_lat, prev.checkin_lng, p_lat, p_lng) / 1000.0;
      jam := extract(epoch from (now() - prev.checkin_at)) / 3600.0;
      if km > 2 and jam > 0 and km / jam > 120 then
        sus := concat_ws('; ', sus, format('Perpindahan %s km dalam %s menit', round(km::numeric, 1), round((jam * 60)::numeric)));
      end if;
    end if;
  end if;
  insert into visits (outlet_id, frontliner_id, cabang_id, checkin_lat, checkin_lng, project_id, checkin_acc, checkin_dist, suspect, suspect_reason)
    values (p_outlet, me.id, me.cabang_id, p_lat, p_lng, me.project_id, p_acc, d, sus is not null, sus) returning id into v;
  return v;
exception when unique_violation then raise exception 'Masih ada kunjungan yang belum check-out.';
end $$;

-- (E) Stok memakai zona waktu cabang
create or replace function stok_hari_ini(p_exclude uuid default null) returns table (product_id uuid, dibawa int, terjual int)
language sql stable security definer set search_path = public as $$
  with d as (select (now() at time zone user_tz())::date as d, user_tz() as z),
  c as (select cs.product_id, sum(cs.qty)::int as q from carry_stock cs, d where cs.frontliner_id = auth.uid() and cs.stock_date = d.d group by 1),
  s as (select sl.product_id, sum(sl.qty)::int as q from sales sl join visits v on v.id = sl.visit_id, d
        where v.frontliner_id = auth.uid() and (v.checkin_at at time zone d.z)::date = d.d and (p_exclude is null or v.id <> p_exclude) group by 1)
  select coalesce(c.product_id, s.product_id), coalesce(c.q, 0), coalesce(s.q, 0) from c full join s on s.product_id = c.product_id $$;

create or replace function stok_tambah(p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare me profiles; it jsonb; q int; pid uuid; d date := (now() at time zone user_tz())::date;
begin
  select * into me from profiles where id = auth.uid();
  if me.role is distinct from 'frontliner' then raise exception 'Hanya frontliner yang mengisi stok pembawaan.'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    q := (it ->> 'qty')::int; pid := (it ->> 'product_id')::uuid;
    if q is null or q <= 0 then continue; end if;
    if q > 100000 then raise exception 'Jumlah stok tidak wajar.'; end if;
    perform 1 from products where id = pid and active; if not found then continue; end if;
    insert into carry_stock (frontliner_id, stock_date, product_id, qty) values (me.id, d, pid, q)
      on conflict (frontliner_id, stock_date, product_id) do update set qty = carry_stock.qty + excluded.qty, updated_at = now();
  end loop;
end $$;

create or replace function stok_koreksi(p_product uuid, p_total int) returns void
language plpgsql security definer set search_path = public as $$
declare me profiles; sold int; z text := user_tz(); d date := (now() at time zone user_tz())::date;
begin
  select * into me from profiles where id = auth.uid();
  if me.role is distinct from 'frontliner' then raise exception 'Hanya frontliner yang mengisi stok pembawaan.'; end if;
  if p_total is null or p_total < 0 or p_total > 100000 then raise exception 'Jumlah stok tidak valid.'; end if;
  select coalesce(sum(s.qty), 0) into sold from sales s join visits v on v.id = s.visit_id
    where v.frontliner_id = me.id and (v.checkin_at at time zone z)::date = d and s.product_id = p_product;
  if p_total < sold then raise exception 'Stok tidak boleh kurang dari yang sudah terjual (% pcs).', sold; end if;
  insert into carry_stock (frontliner_id, stock_date, product_id, qty) values (me.id, d, p_product, p_total)
    on conflict (frontliner_id, stock_date, product_id) do update set qty = excluded.qty, updated_at = now();
end $$;

create or replace function save_sales(p_visit uuid, p_items jsonb, p_lat float8, p_lng float8, p_acc float8) returns void
language plpgsql security definer set search_path = public as $$
declare v visits; it jsonb; p products; on_ boolean; d date; z text; carried int; sold int; q int;
begin
  select * into v from visits where id = p_visit and frontliner_id = auth.uid() and checkout_at is null;
  if not found then raise exception 'Kunjungan tidak aktif.'; end if;
  perform cek_radius(v.outlet_id, p_lat, p_lng, p_acc);
  select coalesce((value #>> '{}')::boolean, true) into on_ from settings where key = 'stok_enforced';
  z := cabang_tz(v.cabang_id); d := (v.checkin_at at time zone z)::date;
  delete from sales where visit_id = p_visit;
  for it in select * from jsonb_array_elements(p_items) loop
    q := (it ->> 'qty')::int;
    if q > 0 then
      select * into p from products where id = (it ->> 'product_id')::uuid and active;
      if found then
        if coalesce(on_, true) then
          select coalesce(sum(qty), 0) into carried from carry_stock where frontliner_id = v.frontliner_id and stock_date = d and product_id = p.id;
          select coalesce(sum(s.qty), 0) into sold from sales s join visits x on x.id = s.visit_id
            where x.frontliner_id = v.frontliner_id and (x.checkin_at at time zone z)::date = d and s.product_id = p.id;
          if sold + q > carried then raise exception 'Stok % tidak cukup. Sisa % pcs, diminta % pcs.', p.product, greatest(carried - sold, 0), q; end if;
        end if;
        insert into sales (visit_id, product_id, qty, price, is_focus) values (p_visit, p.id, q, p.price,
          exists (select 1 from project_focus pf where pf.project_id = v.project_id and pf.product_id = p.id));
      end if;
    end if;
  end loop;
end $$;

-- (F) Stok oleh MDS/RMDM/MDM: koreksi wajib beralasan dan tercatat di audit; laporan stok mengikuti hak akses (RLS)
create function stok_koreksi_admin(p_frontliner uuid, p_product uuid, p_date date, p_total int, p_alasan text) returns void
language plpgsql security definer set search_path = public as $$
declare r user_role; f profiles; sold int; lama int; au text;
begin
  select role, user_id into r, au from profiles where id = auth.uid();
  select * into f from profiles where id = p_frontliner and role = 'frontliner';
  if not found then raise exception 'Frontliner tidak ditemukan.'; end if;
  if r = 'mdm' then null; elsif r in ('mds', 'rmdm') and f.cabang_id in (select my_cabang_ids()) then null; else raise exception 'Anda tidak berwenang atas cabang ini.'; end if;
  if p_alasan is null or length(trim(p_alasan)) < 3 then raise exception 'Alasan koreksi wajib diisi.'; end if;
  if p_total is null or p_total < 0 or p_total > 100000 then raise exception 'Jumlah stok tidak valid.'; end if;
  select coalesce(sum(s.qty), 0) into sold from sales s join visits v on v.id = s.visit_id
    where v.frontliner_id = f.id and (v.checkin_at at time zone cabang_tz(f.cabang_id))::date = p_date and s.product_id = p_product;
  if p_total < sold then raise exception 'Stok tidak boleh kurang dari yang sudah terjual (% pcs).', sold; end if;
  select qty into lama from carry_stock where frontliner_id = f.id and stock_date = p_date and product_id = p_product;
  perform set_config('app.skip_audit', '1', true);
  insert into carry_stock (frontliner_id, stock_date, product_id, qty) values (f.id, p_date, p_product, p_total)
    on conflict (frontliner_id, stock_date, product_id) do update set qty = excluded.qty, updated_at = now();
  perform set_config('app.skip_audit', '', true);
  insert into audit_log (actor, actor_user_id, action, tabel, row_id, detail) values (auth.uid(), au, 'KOREKSI_STOK', 'carry_stock', f.user_id,
    jsonb_build_object('produk', p_product, 'tanggal', p_date, 'dari', coalesce(lama, 0), 'ke', p_total, 'alasan', trim(p_alasan)));
end $$;

create function stok_laporan(p_from date, p_to date, p_cabang uuid default null, p_frontliner uuid default null)
returns table (tanggal date, frontliner_id uuid, product_id uuid, dibawa int, terjual int)
language sql stable as $$
  with c as (select cs.stock_date as d, cs.frontliner_id as f, cs.product_id as p, sum(cs.qty)::int as q
             from carry_stock cs join profiles pr on pr.id = cs.frontliner_id
             where cs.stock_date between p_from and p_to and (p_cabang is null or pr.cabang_id = p_cabang) and (p_frontliner is null or cs.frontliner_id = p_frontliner)
             group by 1, 2, 3),
  s as (select (v.checkin_at at time zone cb.tz)::date as d, v.frontliner_id as f, sl.product_id as p, sum(sl.qty)::int as q
        from sales sl join visits v on v.id = sl.visit_id join cabang cb on cb.id = v.cabang_id
        where v.checkin_at >= p_from::timestamptz - interval '1 day' and v.checkin_at < (p_to + 1)::timestamptz + interval '1 day'
          and (p_cabang is null or v.cabang_id = p_cabang) and (p_frontliner is null or v.frontliner_id = p_frontliner)
        group by 1, 2, 3)
  select coalesce(c.d, s.d), coalesce(c.f, s.f), coalesce(c.p, s.p), coalesce(c.q, 0), coalesce(s.q, 0)
  from c full join s on s.d = c.d and s.f = c.f and s.p = c.p
  where coalesce(c.d, s.d) between p_from and p_to $$;

-- (G) Pindahkan outlet massal dari satu Kode MD ke Kode MD lain (satu cabang; kode outlet tetap agar stabil)
create function outlet_pindah(p_from text, p_to text, p_rayon int default null, p_hitung boolean default false) returns int
language plpgsql security definer set search_path = public as $$
declare r user_role; dst profiles; n int; au text;
begin
  select role, user_id into r, au from profiles where id = auth.uid();
  select * into dst from profiles where user_id = p_to and role = 'frontliner';
  if not found then raise exception 'Kode MD tujuan harus akun frontliner yang terdaftar.'; end if;
  if p_from = p_to then raise exception 'Kode MD asal dan tujuan sama.'; end if;
  if r = 'mdm' then null; elsif r in ('mds', 'rmdm') and dst.cabang_id in (select my_cabang_ids()) then null; else raise exception 'Anda tidak berwenang atas cabang ini.'; end if;
  if p_hitung then
    select count(*) into n from outlets where kode_md = p_from and cabang_id = dst.cabang_id and (p_rayon is null or rayon = p_rayon); return n;
  end if;
  perform set_config('app.skip_audit', '1', true);
  update outlets set kode_md = p_to where kode_md = p_from and cabang_id = dst.cabang_id and (p_rayon is null or rayon = p_rayon);
  get diagnostics n = row_count;
  perform set_config('app.skip_audit', '', true);
  insert into audit_log (actor, actor_user_id, action, tabel, row_id, detail) values (auth.uid(), au, 'PINDAH_OUTLET', 'outlets', p_from || ' -> ' || p_to,
    jsonb_build_object('jumlah', n, 'rayon', p_rayon));
  return n;
end $$;

-- (H) Rekap harian dihitung di database (Home tidak lagi menarik semua baris ke browser; hemat egress paket gratis)
create function rekap_harian(p_from timestamptz, p_to timestamptz) returns jsonb language sql stable as $$
  with v as (select v.id, v.outlet_id, (v.checkin_at at time zone cb.tz)::date as d from visits v join cabang cb on cb.id = v.cabang_id
             where v.checkin_at >= p_from and v.checkin_at < p_to),
  sl as (select v.d, v.outlet_id, pr.product, s.is_focus, s.qty, s.value from sales s join v on v.id = s.visit_id join products pr on pr.id = s.product_id),
  dy as (select d, count(*) as visits from v group by d),
  oc as (select d, count(distinct outlet_id) as oc, sum(value) as value from sl group by d),
  pd as (select d, product, bool_or(is_focus) as focus, sum(qty) as qty, sum(value) as value, count(distinct outlet_id) as ec from sl group by d, product)
  select coalesce(jsonb_object_agg(dy.d, jsonb_build_object('visits', dy.visits, 'oc', coalesce(oc.oc, 0), 'value', coalesce(oc.value, 0), 'outlets', '[]'::jsonb,
    'prod', coalesce((select jsonb_object_agg(pd.product, jsonb_build_object('qty', pd.qty, 'value', pd.value, 'focus', pd.focus, 'ec', pd.ec)) from pd where pd.d = dy.d), '{}'::jsonb))), '{}'::jsonb)
  from dy left join oc on oc.d = dy.d $$;

-- (I) Log error aplikasi (tanpa layanan pihak ketiga), cache alamat, pemantau kapasitas
create table error_log (id bigint generated always as identity primary key, at timestamptz not null default now(), user_id uuid, pesan text, stack text, url text, ua text);
create index error_log_at_idx on error_log (at desc);
alter table error_log enable row level security;
create policy error_read on error_log for select using ((select my_role()) = 'mdm');
create function log_error(p_pesan text, p_stack text, p_url text, p_ua text) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if (select count(*) from error_log where user_id = auth.uid() and at > now() - interval '1 hour') >= 30 then return; end if;   -- cegah banjir log
  insert into error_log (user_id, pesan, stack, url, ua) values (auth.uid(), left(p_pesan, 500), left(p_stack, 2000), left(p_url, 300), left(p_ua, 200));
end $$;

create table geocode_cache (lat4 numeric(8, 4) not null, lng4 numeric(9, 4) not null, hasil jsonb not null, at timestamptz not null default now(), primary key (lat4, lng4));
alter table geocode_cache enable row level security;      -- tanpa policy: hanya server (service role) yang menulis/membaca

create function db_usage() returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if (select role from profiles where id = auth.uid()) is distinct from 'mdm' then raise exception 'Hanya MDM.'; end if;
  return jsonb_build_object('bytes', pg_database_size(current_database()),
    'tabel', (select coalesce(jsonb_agg(t order by (t ->> 'bytes')::bigint desc), '[]'::jsonb) from (
      select jsonb_build_object('nama', c.relname, 'bytes', pg_total_relation_size(c.oid), 'baris', c.reltuples::bigint) as t
      from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'
      order by pg_total_relation_size(c.oid) desc limit 8) x));
end $$;

-- Pembersihan berkala (dipanggil workflow GitHub, bukan dari aplikasi): audit 180 hari, log error 30 hari, cache alamat 365 hari
create function audit_prune(p_hari int default 180) returns void language sql security definer set search_path = public as $$
  delete from audit_log where at < now() - make_interval(days => p_hari);
  delete from error_log where at < now() - interval '30 days';
  delete from geocode_cache where at < now() - interval '365 days' $$;

-- Hak eksekusi
revoke execute on function audit_row(), audit_prune(int) from public, anon, authenticated;
revoke execute on function stok_koreksi_admin(uuid, uuid, date, int, text), stok_laporan(date, date, uuid, uuid), outlet_pindah(text, text, int, boolean),
  rekap_harian(timestamptz, timestamptz), log_error(text, text, text, text), db_usage(),
  stok_hari_ini(uuid), stok_tambah(jsonb), stok_koreksi(uuid, int), save_sales(uuid, jsonb, float8, float8, float8), checkin(bigint, float8, float8, float8) from public, anon;
grant execute on function stok_koreksi_admin(uuid, uuid, date, int, text), stok_laporan(date, date, uuid, uuid), outlet_pindah(text, text, int, boolean),
  rekap_harian(timestamptz, timestamptz), log_error(text, text, text, text), db_usage(),
  stok_hari_ini(uuid), stok_tambah(jsonb), stok_koreksi(uuid, int), save_sales(uuid, jsonb, float8, float8, float8), checkin(bigint, float8, float8, float8) to authenticated;
