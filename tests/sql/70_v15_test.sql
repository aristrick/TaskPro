\set QUIET on
\pset format unaligned
\pset tuples_only on
-- rekap_saya harus sama dengan hitungan langsung dari tabel, dan hanya milik pemanggil
select (select count(*) from visits where frontliner_id = '44444444-4444-4444-4444-444444444444') as n1,
       (select coalesce(sum(s.value), 0) from sales s join visits v on v.id = s.visit_id where v.frontliner_id = '44444444-4444-4444-4444-444444444444') as v1,
       (select count(*) from visits where frontliner_id = '55555555-5555-5555-5555-555555555555') as n2,
       (select count(*) from visits where frontliner_id = '44444444-4444-4444-4444-444444444444' and checkin_at < now() - interval '400 days') as lama1 \gset
set role authenticated; select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
select 'R1 jumlah kunjungan di rekap_saya sama dengan data (selisih harus 0): ' || (:n1 - coalesce((select sum((e.v ->> 'visits')::int) from jsonb_each(rekap_saya(now() - interval '800 days')) e(k, v)), 0));
select 'R2 total nilai penjualan sama dengan data (selisih harus 0): ' || (:v1 - coalesce((select sum((e.v ->> 'value')::numeric) from jsonb_each(rekap_saya(now() - interval '800 days')) e(k, v)), 0));
select 'R3 EC tiap produk tidak melebihi OC hari itu: ' || coalesce(bool_and((p.v ->> 'ec')::int <= (e.v ->> 'oc')::int), true) from jsonb_each(rekap_saya(now() - interval '800 days')) e(k, v), jsonb_each(e.v -> 'prod') p(k, v);
select 'R4 daftar outlet per hari ada dan terurut (jumlah baris outlet > 0): ' || ((select sum(jsonb_array_length(e.v -> 'outlets')) from jsonb_each(rekap_saya(now() - interval '800 days')) e(k, v)) > 0);
select 'R5 batas waktu dihormati (data lebih tua dari batas tidak ikut): ' || (coalesce((select sum((e.v ->> 'visits')::int) from jsonb_each(rekap_saya(now() + interval '1 day')) e(k, v)), 0) = 0);
select set_config('request.jwt.claim.sub','55555555-5555-5555-5555-555555555555',false) \gset
select 'R6 frontliner lain hanya melihat kunjungannya sendiri (selisih harus 0): ' || (:n2 - coalesce((select sum((e.v ->> 'visits')::int) from jsonb_each(rekap_saya(now() - interval '800 days')) e(k, v)), 0));
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false) \gset
select 'R7 MDM tidak punya kunjungan sendiri, hasil kosong: ' || (rekap_saya(now() - interval '800 days') = '{}'::jsonb);
reset role; set role anon;
\echo --- R8 anon memanggil rekap_saya (harus ditolak):
select rekap_saya(now() - interval '1 day');
