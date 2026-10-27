\set QUIET on
\pset format unaligned
\pset tuples_only on
-- Hapus seluruh kunjungan (migrasi 18)
update visits set checkout_at = now() where checkout_at is null;
update profiles set min_checkout_menit = 0 where id='44444444-4444-4444-4444-444444444444';
select id as oa from outlets where name='Outlet A' \gset

set role authenticated; select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
select checkin(:oa,null,null,null) as vk \gset
select save_sales(:'vk','[{"product_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","qty":4},{"product_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","qty":1}]',null,null,null);
select checkout(:'vk');
reset role;
select 'X1 sebelum hapus: kunjungan=' || (select count(*) from visits where id=:'vk') || ', penjualan=' || (select count(*) from sales where visit_id=:'vk');

set role authenticated; select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false) \gset
\echo --- X2 MDS menghapus kunjungan (harus ditolak):
select kunjungan_hapus(:'vk','uji hapus');
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
\echo --- X3 frontliner menghapus kunjungannya sendiri (harus ditolak):
select kunjungan_hapus(:'vk','uji hapus');
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false) \gset
\echo --- X4 alasan kosong (harus ditolak):
select kunjungan_hapus(:'vk','  ');
\echo --- X5 kunjungan tidak ada (harus ditolak):
select kunjungan_hapus('00000000-0000-0000-0000-000000000000','uji hapus');
reset role;
select 'X6 penolakan tidak mengubah data: kunjungan=' || (select count(*) from visits where id=:'vk') || ', penjualan=' || (select count(*) from sales where visit_id=:'vk');

set role authenticated; select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false) \gset
select kunjungan_hapus(:'vk','check-in salah outlet');
reset role;
select 'X7 kunjungan dan penjualannya terhapus: kunjungan=' || (select count(*) from visits where id=:'vk') || ', penjualan=' || (select count(*) from sales where visit_id=:'vk');
select 'X8 audit HAPUS_KUNJUNGAN: ' || (detail ->> 'alasan') || ' | ' || jsonb_array_length(detail -> 'lama' -> 'penjualan') || ' baris, total ' || (detail -> 'lama' ->> 'total') || ' | berjalan ' || (detail ->> 'berjalan') || ' | frontliner ' || (detail ->> 'frontliner') from audit_log where action='HAPUS_KUNJUNGAN' order by id desc limit 1;

-- kunjungan yang masih berjalan boleh dihapus, dan membebaskan frontliner untuk check-in lagi
set role authenticated; select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
select checkin(:oa,null,null,null) as vr \gset
\echo --- X9 check-in kedua saat kunjungan masih berjalan (harus ditolak):
select checkin(:oa,null,null,null);
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false) \gset
select kunjungan_hapus(:'vr','kunjungan ganda');
reset role;
select 'X10 kunjungan berjalan terhapus: ' || (select count(*) from visits where id=:'vr');
select 'X11 audit menandai berjalan: ' || (detail ->> 'berjalan') from audit_log where action='HAPUS_KUNJUNGAN' order by id desc limit 1;
set role authenticated; select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
select 'X12 frontliner bisa check-in lagi: ' || (checkin(:oa,null,null,null) is not null);
reset role; set role anon;
\echo --- X13 tanpa login (harus ditolak):
select kunjungan_hapus(:'vk','uji hapus');
reset role;
update visits set checkout_at = now() where checkout_at is null;
select 'X14 jumlah catatan audit HAPUS_KUNJUNGAN: ' || count(*) from audit_log where action='HAPUS_KUNJUNGAN';
