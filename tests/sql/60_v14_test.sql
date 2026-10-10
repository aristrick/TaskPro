\set QUIET on
\pset format unaligned
\pset tuples_only on
update visits set checkout_at = now() where checkout_at is null;
select id as oa from outlets where name='Outlet A' \gset
insert into outlets(cabang_id,name,address,lat,long,kode_md,rayon) values ('cccccccc-cccc-cccc-cccc-cccccccccccc','Outlet K','k',-6.2,106.9,'0300-TMTB05',1);
select id as ob from outlets where name='Outlet K' \gset

select 'K0 bawaan semua frontliner tanpa batas (harus 0): ' || max(min_checkout_menit) from profiles where role='frontliner';
update profiles set min_checkout_menit = 3 where id='44444444-4444-4444-4444-444444444444';
set role authenticated; select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
select checkin(:oa,null,null,null) as vk \gset
\echo --- K1 check-out langsung dengan batas 3 menit (harus ditolak):
select checkout(:'vk');
reset role;
update visits set checkin_at = now() - interval '179 seconds' where id = :'vk';
set role authenticated; select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
\echo --- K2 179 detik setelah check-in, kurang dari 3 menit (harus ditolak):
select checkout(:'vk');
reset role;
select 'K3 kunjungan masih terbuka setelah penolakan: ' || (checkout_at is null) from visits where id = :'vk';
update visits set checkin_at = now() - interval '181 seconds' where id = :'vk';
set role authenticated; select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
select checkout(:'vk');
reset role;
select 'K4 181 detik setelah check-in, check-out berhasil: ' || (checkout_at is not null) from visits where id = :'vk';

-- frontliner lain tanpa batas: langsung boleh
set role authenticated; select set_config('request.jwt.claim.sub','55555555-5555-5555-5555-555555555555',false) \gset
select checkin(:ob,null,null,null) as vb \gset
select checkout(:'vb');
reset role;
select 'K5 frontliner tanpa batas langsung check-out: ' || (checkout_at is not null) from visits where id = :'vb';

-- batas diubah saat kunjungan berjalan: aturan terbaru yang berlaku
set role authenticated; select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
select checkin(:oa,null,null,null) as vm \gset
reset role;
update profiles set min_checkout_menit = 0 where id='44444444-4444-4444-4444-444444444444';
set role authenticated; select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
select checkout(:'vm');
reset role;
select 'K6 batas dimatikan, check-out langsung berhasil: ' || (checkout_at is not null) from visits where id = :'vm';
\echo --- K7 batas di atas 120 menit (harus ditolak):
update profiles set min_checkout_menit = 121 where id='44444444-4444-4444-4444-444444444444';
\echo --- K8 batas negatif (harus ditolak):
update profiles set min_checkout_menit = -1 where id='44444444-4444-4444-4444-444444444444';
select 'K9 nilai tetap 0 setelah penolakan: ' || min_checkout_menit from profiles where id='44444444-4444-4444-4444-444444444444';
