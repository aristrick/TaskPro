\set QUIET on
\pset format unaligned
\pset tuples_only on
-- Hapus penjualan (migrasi 17)
update visits set checkout_at = now() where checkout_at is null;
update profiles set min_checkout_menit = 0 where id='44444444-4444-4444-4444-444444444444';
select id as oa from outlets where name='Outlet A' \gset

set role authenticated; select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
select checkin(:oa,null,null,null) as vh \gset
select save_sales(:'vh','[{"product_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","qty":2},{"product_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","qty":3}]',null,null,null);
select checkout(:'vh');
reset role;
select 'S1 sebelum hapus: baris=' || (select count(*) from sales where visit_id=:'vh') || ', effective=' || (select effective from visits where id=:'vh');

set role authenticated; select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false) \gset
\echo --- S2 MDS menghapus penjualan (harus ditolak):
select penjualan_hapus(:'vh','uji hapus');
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
\echo --- S3 frontliner menghapus penjualannya sendiri (harus ditolak):
select penjualan_hapus(:'vh','uji hapus');
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false) \gset
\echo --- S4 alasan kosong (harus ditolak):
select penjualan_hapus(:'vh','');
\echo --- S5 kunjungan tidak ada (harus ditolak):
select penjualan_hapus('00000000-0000-0000-0000-000000000000','uji hapus');
reset role;
select 'S6 penolakan tidak mengubah data: baris=' || count(*) from sales where visit_id=:'vh';

set role authenticated; select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false) \gset
select penjualan_hapus(:'vh','salah input jumlah');
reset role;
select 'S7 semua baris penjualan terhapus: baris=' || (select count(*) from sales where visit_id=:'vh') || ', effective=' || (select effective from visits where id=:'vh');
select 'S8 kunjungan tetap ada dengan jam check-in dan check-out utuh: ' || (checkin_at is not null and checkout_at is not null) from visits where id=:'vh';
select 'S9 audit HAPUS_PENJUALAN: ' || (detail ->> 'alasan') || ' | ' || jsonb_array_length(detail -> 'lama' -> 'penjualan') || ' baris, total ' || (detail -> 'lama' ->> 'total') || ' | frontliner ' || (detail ->> 'frontliner') from audit_log where action='HAPUS_PENJUALAN' order by id desc limit 1;

set role authenticated; select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false) \gset
\echo --- S10 kunjungan tanpa penjualan (harus ditolak):
select penjualan_hapus(:'vh','sekali lagi');
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
select checkin(:oa,null,null,null) as vb \gset
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false) \gset
\echo --- S11 kunjungan masih berjalan (harus ditolak):
select penjualan_hapus(:'vb','uji hapus');
reset role; set role anon;
\echo --- S12 tanpa login (harus ditolak):
select penjualan_hapus(:'vh','uji hapus');
reset role;
update visits set checkout_at = now() where checkout_at is null;
select 'S13 jumlah catatan audit HAPUS_PENJUALAN: ' || count(*) from audit_log where action='HAPUS_PENJUALAN';
