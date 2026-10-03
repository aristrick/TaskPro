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
