-- Migrasi 13: hapus paksa outlet per frontliner (MDM), edit kunjungan/penjualan (MDM), dan arsip outlet terhapus. Jalankan sekali.

-- Arsip outlet yang dihapus massal (jaring pengaman; dibuang otomatis setelah 90 hari oleh audit_prune)
create table outlet_arsip (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid, kode_md text, rayon int,
  data jsonb not null);
create index outlet_arsip_at_idx on outlet_arsip (at);
alter table outlet_arsip enable row level security;
create policy arsip_read on outlet_arsip for select using ((select my_role()) = 'mdm');

-- Hapus semua outlet milik satu Kode MD (opsional satu rayon). Hanya MDM.
-- p_riwayat=false: outlet yang pernah dikunjungi dilewati. p_riwayat=true: kunjungan dan penjualannya ikut dihapus PERMANEN.
-- p_hitung=true: hanya menghitung dampaknya.
create function outlet_hapus_massal(p_kode_md text, p_rayon int default null, p_riwayat boolean default false, p_hitung boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare ids bigint[]; n_all int; n_hist int; n_vis int; n_sales int; n_open int; au text; d_out int := 0; d_vis int := 0;
begin
  if (select role from profiles where id = auth.uid()) is distinct from 'mdm' then raise exception 'Hanya MDM.'; end if;
  if p_kode_md is null or length(trim(p_kode_md)) = 0 then raise exception 'Pilih frontliner (Kode MD).'; end if;
  select coalesce(array_agg(id), '{}') into ids from outlets where kode_md = p_kode_md and (p_rayon is null or rayon = p_rayon);
  n_all := coalesce(array_length(ids, 1), 0);
  select count(distinct outlet_id), count(*) into n_hist, n_vis from visits where outlet_id = any(ids);
  select count(*) into n_sales from sales s join visits v on v.id = s.visit_id where v.outlet_id = any(ids);
  select count(*) into n_open from visits where outlet_id = any(ids) and checkout_at is null;
  if p_hitung then
    return jsonb_build_object('outlet', n_all, 'dengan_riwayat', n_hist, 'kunjungan', n_vis, 'penjualan', n_sales, 'berjalan', n_open);
  end if;
  if n_all = 0 then raise exception 'Tidak ada outlet yang cocok.'; end if;
  if n_open > 0 then raise exception 'Ada % kunjungan yang masih berjalan di outlet ini. Minta frontliner check-out dulu.', n_open; end if;
  select user_id into au from profiles where id = auth.uid();
  perform set_config('app.skip_audit', '1', true);
  if p_riwayat then
    insert into outlet_arsip (actor, kode_md, rayon, data) select auth.uid(), p_kode_md, p_rayon, to_jsonb(o) from outlets o where o.id = any(ids);
    delete from visits where outlet_id = any(ids);                    -- baris penjualan ikut terhapus (cascade)
    get diagnostics d_vis = row_count;
    delete from outlets where id = any(ids);
    get diagnostics d_out = row_count;
  else
    insert into outlet_arsip (actor, kode_md, rayon, data) select auth.uid(), p_kode_md, p_rayon, to_jsonb(o) from outlets o
      where o.id = any(ids) and not exists (select 1 from visits v where v.outlet_id = o.id);
    delete from outlets o where o.id = any(ids) and not exists (select 1 from visits v where v.outlet_id = o.id);
    get diagnostics d_out = row_count;
  end if;
  perform set_config('app.skip_audit', '', true);
  insert into audit_log (actor, actor_user_id, action, tabel, row_id, detail) values (auth.uid(), au, 'HAPUS_MASSAL_OUTLET', 'outlets', p_kode_md,
    jsonb_build_object('rayon', p_rayon, 'dengan_riwayat', p_riwayat, 'outlet_dihapus', d_out, 'kunjungan_dihapus', d_vis,
      'penjualan_dihapus', case when p_riwayat then n_sales else 0 end, 'dilewati_punya_riwayat', case when p_riwayat then 0 else n_hist end));
  return jsonb_build_object('outlet_dihapus', d_out, 'kunjungan_dihapus', d_vis, 'dilewati', case when p_riwayat then 0 else n_hist end);
end $$;

-- Edit satu kunjungan: waktu check-in/check-out dan seluruh baris penjualannya (produk, jumlah, harga satuan). Hanya MDM; wajib beralasan.
-- p_items: [{"product_id": "...", "qty": 3, "price": 8000}]  (price kosong = harga produk saat ini). Stok pembawaan TIDAK dihitung ulang.
create function kunjungan_edit(p_visit uuid, p_checkin timestamptz, p_checkout timestamptz, p_items jsonb, p_alasan text) returns void
language plpgsql security definer set search_path = public as $$
declare v visits; it jsonb; p products; au text; q int; hrg numeric; lama jsonb; baru jsonb; seen uuid[] := '{}'; fl text; ol text;
begin
  if (select role from profiles where id = auth.uid()) is distinct from 'mdm' then raise exception 'Hanya MDM.'; end if;
  if p_alasan is null or length(trim(p_alasan)) < 3 then raise exception 'Alasan perubahan wajib diisi.'; end if;
  select * into v from visits where id = p_visit;
  if not found then raise exception 'Kunjungan tidak ditemukan.'; end if;
  if p_checkin is null or p_checkout is null then raise exception 'Waktu check-in dan check-out wajib diisi.'; end if;
  if p_checkout < p_checkin then raise exception 'Waktu check-out tidak boleh sebelum check-in.'; end if;
  if p_checkout > now() + interval '1 day' then raise exception 'Waktu tidak boleh di masa depan.'; end if;
  select user_id into au from profiles where id = auth.uid();
  select user_id into fl from profiles where id = v.frontliner_id;
  select name into ol from outlets where id = v.outlet_id;
  lama := jsonb_build_object('checkin', v.checkin_at, 'checkout', v.checkout_at, 'penjualan',
    (select coalesce(jsonb_agg(jsonb_build_object('produk', pr.product, 'qty', s.qty, 'harga', s.price) order by pr.product), '[]'::jsonb)
       from sales s join products pr on pr.id = s.product_id where s.visit_id = v.id));
  delete from sales where visit_id = v.id;
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    q := (it ->> 'qty')::int; hrg := nullif(it ->> 'price', '')::numeric;
    if q is null or q <= 0 then raise exception 'Jumlah (pcs) harus lebih dari 0.'; end if;
    select * into p from products where id = (it ->> 'product_id')::uuid;
    if not found then raise exception 'Produk tidak ditemukan.'; end if;
    if p.id = any(seen) then raise exception 'Produk % muncul dua kali. Gabungkan jumlahnya.', p.product; end if;
    seen := seen || p.id;
    if hrg is null then hrg := p.price; end if;
    if hrg < 0 then raise exception 'Harga tidak boleh negatif.'; end if;
    insert into sales (visit_id, product_id, qty, price, is_focus) values (v.id, p.id, q, hrg,
      exists (select 1 from project_focus pf where pf.project_id = v.project_id and pf.product_id = p.id));
  end loop;
  update visits set checkin_at = p_checkin, checkout_at = p_checkout, effective = exists (select 1 from sales where visit_id = v.id) where id = v.id;
  baru := jsonb_build_object('checkin', p_checkin, 'checkout', p_checkout, 'penjualan',
    (select coalesce(jsonb_agg(jsonb_build_object('produk', pr.product, 'qty', s.qty, 'harga', s.price) order by pr.product), '[]'::jsonb)
       from sales s join products pr on pr.id = s.product_id where s.visit_id = v.id));
  insert into audit_log (actor, actor_user_id, action, tabel, row_id, detail) values (auth.uid(), au, 'EDIT_PENJUALAN', 'visits', v.id::text,
    jsonb_build_object('frontliner', fl, 'outlet', ol, 'alasan', trim(p_alasan), 'lama', lama, 'baru', baru));
end $$;

-- Arsip ikut dibersihkan (90 hari)
create or replace function audit_prune(p_hari int default 180) returns void language sql security definer set search_path = public as $$
  delete from audit_log where at < now() - make_interval(days => p_hari);
  delete from error_log where at < now() - interval '30 days';
  delete from geocode_cache where at < now() - interval '365 days';
  delete from outlet_arsip where at < now() - interval '90 days' $$;

revoke execute on function outlet_hapus_massal(text, int, boolean, boolean), kunjungan_edit(uuid, timestamptz, timestamptz, jsonb, text) from public, anon;
grant execute on function outlet_hapus_massal(text, int, boolean, boolean), kunjungan_edit(uuid, timestamptz, timestamptz, jsonb, text) to authenticated;
