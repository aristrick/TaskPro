\set QUIET on
\pset format unaligned
\pset tuples_only on
-- Check-out tertunda (migrasi 16)
update visits set checkout_at = now() where checkout_at is null;
update profiles set min_checkout_menit = 0 where id='44444444-4444-4444-4444-444444444444';
select id as oa from outlets where name='Outlet A' \gset

-- kunjungan 3 jam lalu yang punya penjualan
set role authenticated; select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
select checkin(:oa,null,null,null) as vt \gset
reset role;
update visits set checkin_at = now() - interval '3 hours' where id = :'vt';
insert into sales (visit_id, product_id, qty, price, is_focus) select :'vt', id, 2, price, false from products limit 1;
set role authenticated; select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
\echo --- O1 waktu sebelum check-in (harus ditolak):
select checkout_tertunda(:'vt', now() - interval '4 hours');
\echo --- O2 waktu di masa depan (harus ditolak):
select checkout_tertunda(:'vt', now() + interval '10 minutes');
reset role;
select 'O3 penolakan tidak mengubah data, kunjungan masih terbuka: ' || (checkout_at is null) from visits where id = :'vt';
set role authenticated; select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
select checkout_tertunda(:'vt', now() - interval '2 hours');
reset role;
select 'O4 check-out memakai waktu yang dikirim (2 jam lalu, selisih di bawah 5 detik): ' || (abs(extract(epoch from (checkout_at - (now() - interval '2 hours')))) < 5) from visits where id = :'vt';
select 'O5 effective benar karena ada penjualan: ' || effective from visits where id = :'vt';
set role authenticated; select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
\echo --- O6 dikirim ulang setelah selesai (harus ditolak dengan Kunjungan tidak aktif, dipakai aplikasi sebagai tanda sudah terkirim):
select checkout_tertunda(:'vt', now() - interval '1 hour');
reset role;
select 'O7 pengiriman ulang tidak mengubah jam check-out (selisih di bawah 5 detik dari 2 jam lalu): ' || (abs(extract(epoch from (checkout_at - (now() - interval '2 hours')))) < 5) from visits where id = :'vt';

-- batas minimal check-out dihitung dari waktu yang dikirim
update profiles set min_checkout_menit = 5 where id='44444444-4444-4444-4444-444444444444';
set role authenticated; select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
select checkin(:oa,null,null,null) as vm \gset
reset role;
update visits set checkin_at = now() - interval '1 hour' where id = :'vm';
select (checkin_at + interval '2 minutes')::text as t2, (checkin_at + interval '6 minutes')::text as t6 from visits where id = :'vm' \gset
set role authenticated; select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
\echo --- O8 waktu kirim 2 menit setelah check-in, batas 5 menit (harus ditolak):
select checkout_tertunda(:'vm', :'t2'::timestamptz);
select checkout_tertunda(:'vm', :'t6'::timestamptz);
reset role;
select 'O9 waktu kirim 6 menit setelah check-in diterima dan dicatat apa adanya: ' || (checkout_at = :'t6'::timestamptz) from visits where id = :'vm';
select 'O10 tanpa penjualan, effective false: ' || (not effective) from visits where id = :'vm';
update profiles set min_checkout_menit = 0 where id='44444444-4444-4444-4444-444444444444';

-- data tertunda lebih dari 48 jam ditolak, lalu check-out biasa tetap bisa dipakai sebagai cadangan
set role authenticated; select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
select checkin(:oa,null,null,null) as vo \gset
reset role;
update visits set checkin_at = now() - interval '5 days' where id = :'vo';
set role authenticated; select set_config('request.jwt.claim.sub','55555555-5555-5555-5555-555555555555',false) \gset
\echo --- O11 frontliner lain mencoba menutup kunjungan ini (harus ditolak):
select checkout_tertunda(:'vo', now() - interval '4 days');
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
\echo --- O12 waktu 4 hari lalu, lebih dari 48 jam (harus ditolak):
select checkout_tertunda(:'vo', now() - interval '4 days');
reset role;
select 'O13 kunjungan masih terbuka setelah penolakan: ' || (checkout_at is null) from visits where id = :'vo';
reset role; set role anon;
\echo --- O14 tanpa login (harus ditolak):
select checkout_tertunda(:'vo', now());
reset role;
set role authenticated; select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
select checkout(:'vo');
reset role;
select 'O15 cadangan checkout() biasa berhasil: ' || (checkout_at is not null) from visits where id = :'vo';
