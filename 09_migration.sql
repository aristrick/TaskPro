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
