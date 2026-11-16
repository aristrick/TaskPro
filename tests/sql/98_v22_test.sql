\set QUIET on
\pset format unaligned
\pset tuples_only on
-- Tracking Go (migrasi 22): Back Tracking dan OTJ
update visits set checkout_at = now() where checkout_at is null;
update profiles set schedule_locked = false;
insert into visits(outlet_id, frontliner_id, cabang_id, checkin_at, checkout_at)
  select o.id, case o.name when 'Outlet A' then '44444444-4444-4444-4444-444444444444'::uuid else '55555555-5555-5555-5555-555555555555'::uuid end,
         'cccccccc-cccc-cccc-cccc-cccccccccccc', now() - interval '3 hours', now() - interval '2 hours'
  from outlets o where o.name in ('Outlet A', 'Outlet F2 R5');
select id as va from visits where outlet_id = (select id from outlets where name = 'Outlet A') order by checkin_at desc limit 1 \gset
select id as vb from visits where outlet_id = (select id from outlets where name = 'Outlet F2 R5') order by checkin_at desc limit 1 \gset

-- ===== Z1. siapa boleh mengonfirmasi, dan jarak 50 m dijaga di database =====
set role authenticated; select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
\echo --- Z1 frontliner mengonfirmasi (harus ditolak):
select backtrack_simpan(:'va', -6.2, 106.9, 5, '{"toko_ada":true,"penjualan_sesuai":true,"jam_kunjungan":{"status":"N/A"},"on_rayon":{"status":"Sesuai"},"kunjungan_manual":{"status":"Sesuai"},"pv_satu":{"status":"Sesuai"}}');
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false) \gset
\echo --- Z2 TL dari jauh (harus ditolak):
select backtrack_simpan(:'va', -6.0, 106.9, 5, '{"toko_ada":true,"penjualan_sesuai":true,"jam_kunjungan":{"status":"N/A"},"on_rayon":{"status":"Sesuai"},"kunjungan_manual":{"status":"Sesuai"},"pv_satu":{"status":"Sesuai"}}');
\echo --- Z3 GPS tidak terbaca (harus ditolak):
select backtrack_simpan(:'va', null, null, null, '{"toko_ada":true,"penjualan_sesuai":true,"jam_kunjungan":{"status":"N/A"},"on_rayon":{"status":"Sesuai"},"kunjungan_manual":{"status":"Sesuai"},"pv_satu":{"status":"Sesuai"}}');
\echo --- Z4 status indikator tidak dikenal (harus ditolak):
select backtrack_simpan(:'va', -6.2, 106.9, 5, '{"toko_ada":true,"penjualan_sesuai":true,"jam_kunjungan":{"status":"N/A"},"on_rayon":{"status":"Mungkin"},"kunjungan_manual":{"status":"Sesuai"},"pv_satu":{"status":"Sesuai"}}');
\echo --- Z5 toko ada belum dijawab (harus ditolak):
select backtrack_simpan(:'va', -6.2, 106.9, 5, '{"penjualan_sesuai":true,"jam_kunjungan":{"status":"N/A"},"on_rayon":{"status":"Sesuai"},"kunjungan_manual":{"status":"Sesuai"},"pv_satu":{"status":"Sesuai"}}');
-- Akurasi GPS 30 m menolong titik 60 m dari outlet (60 - 30 = 30 <= 50), tetapi akurasi tidak boleh dilebihkan di atas 30 m
select 'Z6 TL di 60 m dengan akurasi 100 (dipotong 30): ' || case when backtrack_simpan(:'va', -6.2 + 60 / 111195.0, 106.9, 100, '{"toko_ada":true,"penjualan_sesuai":false,"jam_kunjungan":{"status":"N/A","keterangan":"Toko Ke-2"},"on_rayon":{"status":"Sesuai"},"kunjungan_manual":{"status":"TS","keterangan":"x"},"pv_satu":{"status":"Sesuai"},"temuan_lain":"ada temuan"}') is not null then 'tersimpan' end;
\echo --- Z7 kunjungan yang sama dikonfirmasi lagi (harus ditolak):
select backtrack_simpan(:'va', -6.2, 106.9, 5, '{"toko_ada":true,"penjualan_sesuai":true,"jam_kunjungan":{"status":"N/A"},"on_rayon":{"status":"Sesuai"},"kunjungan_manual":{"status":"Sesuai"},"pv_satu":{"status":"Sesuai"}}');
select 'Z8 isi tersimpan: ' || oleh_user_id || ' / ' || oleh_role || ' / ' || frontliner_user_id || ' / ' || outlet_nama || ' / jarak ' || jarak_m || ' m / manual ' || (kunjungan_manual ->> 'status') || ' / ' || (jam_kunjungan ->> 'keterangan') from backtrack_konfirmasi;
reset role;
select 'Z9 tanggal kunjungan sesuai zona cabang: ' || (visit_date = ((now() - interval '3 hours') at time zone 'Asia/Jakarta')::date) from backtrack_konfirmasi;

-- ===== Z2. orang lain tidak bisa mengonfirmasi atau membaca =====
set role authenticated; select set_config('request.jwt.claim.sub','ffffffff-ffff-ffff-ffff-ffffffffffff',false) \gset
\echo --- Z10 RMDM cabang lain mengonfirmasi (harus ditolak):
select backtrack_simpan(:'vb', -6.2, 106.9, 5, '{"toko_ada":true,"penjualan_sesuai":true,"jam_kunjungan":{"status":"N/A"},"on_rayon":{"status":"Sesuai"},"kunjungan_manual":{"status":"Sesuai"},"pv_satu":{"status":"Sesuai"}}');
select 'Z11 RMDM cabang lain membaca: ' || count(*) from backtrack_konfirmasi;
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
select 'Z12 frontliner membaca: ' || count(*) from backtrack_konfirmasi;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false) \gset
select 'Z13 MDS membaca: ' || count(*) from backtrack_konfirmasi;
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',false) \gset
select 'Z14 RMDM cabang itu membaca: ' || count(*) from backtrack_konfirmasi;
\echo --- Z15 insert langsung tanpa fungsi (harus ditolak):
insert into backtrack_konfirmasi(cabang_id, visit_date, toko_ada, penjualan_sesuai, jam_kunjungan, on_rayon, kunjungan_manual, pv_satu)
  values ('cccccccc-cccc-cccc-cccc-cccccccccccc', current_date, true, true, '{}', '{}', '{}', '{}');
\echo --- Z16 ubah langsung tanpa fungsi (tidak ada yang berubah):
update backtrack_konfirmasi set toko_ada = false;
select 'Z17 toko_ada tetap: ' || toko_ada from backtrack_konfirmasi;
reset role;

-- ===== Z3. hapus hanya MDM/RMDM, tercatat audit =====
delete from visits where id = :'va';
select 'Z17b kunjungan dihapus: konfirmasi tetap ada sebagai arsip, tautan kosong: ' || (visit_id is null) || ' / ' || outlet_nama from backtrack_konfirmasi;
set role authenticated; select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false) \gset
delete from backtrack_konfirmasi;
select 'Z18 MDS menghapus, sisa: ' || count(*) from backtrack_konfirmasi;
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',false) \gset
delete from backtrack_konfirmasi;
reset role;
select 'Z19 RMDM menghapus, sisa: ' || count(*) from backtrack_konfirmasi;
select 'Z20 audit hapus: ' || count(*) from audit_log where tabel = 'backtrack_konfirmasi' and action = 'DELETE';

-- ===== Z4. OTJ =====
insert into auth.users(id,email) values ('99999999-9999-9999-9999-999999999999','tl2@x'),('88888888-8888-8888-8888-888888888888','f3@x');
insert into profiles(id,user_id,nama,role,cabang_id) values ('99999999-9999-9999-9999-999999999999','0300-TL02','TL dua','tl','cccccccc-cccc-cccc-cccc-cccccccccccc');
insert into profiles(id,user_id,nama,role,cabang_id,atasan_id) values ('88888888-8888-8888-8888-888888888888','0300-TMTB09','F3','frontliner','cccccccc-cccc-cccc-cccc-cccccccccccc','99999999-9999-9999-9999-999999999999');
set role authenticated; select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
\echo --- Z22 frontliner mengisi OTJ (harus ditolak):
select otj_simpan('{"tipe":"Taskforce","cabang_id":"cccccccc-cccc-cccc-cccc-cccccccccccc","frontliner_id":"44444444-4444-4444-4444-444444444444","tanggal":"2026-01-05","kunjungan":[{"outlet_nama":"A"}]}'::jsonb);
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false) \gset
select 'Z23 TL menilai bawahannya: ' || (otj_simpan(jsonb_build_object('tipe','Taskforce','divisi','TFB','cabang_id','cccccccc-cccc-cccc-cccc-cccccccccccc','frontliner_id','44444444-4444-4444-4444-444444444444','tanggal','2026-01-05',
  'jawaban_pra','{"pra-0-0":"Ya"}'::jsonb,'kunjungan','[{"outlet_id":1,"outlet_nama":"Outlet A","jawaban":{"kunjungan-0-0":"Ya"}}]'::jsonb,'skor',100)) is not null);
\echo --- Z24 tanggal di masa depan (harus ditolak):
select otj_simpan('{"tipe":"Taskforce","cabang_id":"cccccccc-cccc-cccc-cccc-cccccccccccc","frontliner_id":"44444444-4444-4444-4444-444444444444","tanggal":"2099-01-01","kunjungan":[{"outlet_nama":"A"}]}'::jsonb);
\echo --- Z25 tanpa toko (harus ditolak):
select otj_simpan('{"tipe":"Taskforce","cabang_id":"cccccccc-cccc-cccc-cccc-cccccccccccc","frontliner_id":"44444444-4444-4444-4444-444444444444","tanggal":"2026-01-05","kunjungan":[]}'::jsonb);
\echo --- Z26 tipe tidak dikenal (harus ditolak):
select otj_simpan('{"tipe":"Lain","cabang_id":"cccccccc-cccc-cccc-cccc-cccccccccccc","frontliner_id":"44444444-4444-4444-4444-444444444444","tanggal":"2026-01-05","kunjungan":[{"outlet_nama":"A"}]}'::jsonb);
\echo --- Z27b TL menilai frontliner milik TL lain (harus ditolak):
select otj_simpan('{"tipe":"Taskforce","cabang_id":"cccccccc-cccc-cccc-cccc-cccccccccccc","frontliner_id":"88888888-8888-8888-8888-888888888888","tanggal":"2026-01-05","kunjungan":[{"outlet_nama":"A"}]}'::jsonb);
\echo --- Z27 yang dinilai bukan frontliner cabang ini (harus ditolak):
select otj_simpan('{"tipe":"Taskforce","cabang_id":"cccccccc-cccc-cccc-cccc-cccccccccccc","frontliner_id":"22222222-2222-2222-2222-222222222222","tanggal":"2026-01-05","kunjungan":[{"outlet_nama":"A"}]}'::jsonb);
select set_config('request.jwt.claim.sub','ffffffff-ffff-ffff-ffff-ffffffffffff',false) \gset
\echo --- Z28 RMDM cabang lain mengisi OTJ (harus ditolak):
select otj_simpan('{"tipe":"Taskforce","cabang_id":"cccccccc-cccc-cccc-cccc-cccccccccccc","frontliner_id":"44444444-4444-4444-4444-444444444444","tanggal":"2026-01-05","kunjungan":[{"outlet_nama":"A"}]}'::jsonb);
select 'Z29 RMDM cabang lain membaca OTJ: ' || count(*) from otj_penilaian;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false) \gset
select otj_simpan('{"tipe":"MD GT","divisi":"MOTORIS","cabang_id":"cccccccc-cccc-cccc-cccc-cccccccccccc","frontliner_id":"55555555-5555-5555-5555-555555555555","tanggal":"2026-01-06","skor":250,"kunjungan":[{"outlet_nama":"B"}]}'::jsonb) as o30 \gset
select 'Z30 MDS: skor di luar 0-100 disimpan kosong: ' || (select skor is null from otj_penilaian where id = :'o30');
select otj_simpan('{"tipe":"Taskforce","cabang_id":"cccccccc-cccc-cccc-cccc-cccccccccccc","frontliner_id":"88888888-8888-8888-8888-888888888888","tanggal":"2026-01-07","kunjungan":[{"outlet_nama":"C"}]}'::jsonb) is not null as ok31 \gset
select 'Z31 MDS membaca OTJ: ' || count(*) from otj_penilaian;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false) \gset
select 'Z32 TL membaca OTJ bawahannya saja (bukan frontliner TL lain): ' || count(*) from otj_penilaian;
\echo --- Z33 ubah langsung (tidak ada yang berubah):
update otj_penilaian set skor = 0;
select 'Z34 skor OTJ tetap: ' || string_agg(coalesce(skor::text, 'kosong'), ',' order by tanggal) from otj_penilaian;
reset role;
