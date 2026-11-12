\set QUIET on
\pset format unaligned
\pset tuples_only on
-- Schedule Taskforce (migrasi 19)
update visits set checkout_at = now() where checkout_at is null;
update profiles set min_checkout_menit = 0 where id in ('44444444-4444-4444-4444-444444444444','55555555-5555-5555-5555-555555555555');
insert into auth.users(id,email) values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','rmdm@x'),('ffffffff-ffff-ffff-ffff-ffffffffffff','rmdm2@x');
insert into profiles(id,user_id,nama,role,cabang_id) values
 ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','RMDM01','RMDM','rmdm',null),('ffffffff-ffff-ffff-ffff-ffffffffffff','RMDM02','RMDM lain','rmdm',null);
update cabang set rmdm_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
insert into outlets(cabang_id,name,address,lat,long,kode_md,rayon) values
 ('cccccccc-cccc-cccc-cccc-cccccccccccc','Outlet R2','x',-6.2,106.9,'0300-TMTB01',2),
 ('cccccccc-cccc-cccc-cccc-cccccccccccc','Outlet R3','x',-6.2,106.9,'0300-TMTB01',3),
 ('cccccccc-cccc-cccc-cccc-cccccccccccc','Outlet F2 R5','x',-6.2,106.9,'0300-TMTB05',5);
select id as oa from outlets where name='Outlet A' \gset
select id as o2 from outlets where name='Outlet R2' \gset
select id as ob from outlets where name='Outlet F2 R5' \gset

-- ===== J1. rumus siklus (tanggal eksplisit, tidak bergantung hari ini) =====
select 'W1a patokan bawaan 2024-01-01 Senin: ' || (select minggu || '/' || hari from schedule_posisi('cccccccc-cccc-cccc-cccc-cccccccccccc', date '2024-01-01'));
select 'W1b Sabtu minggu 1: ' || (select minggu || '/' || hari from schedule_posisi('cccccccc-cccc-cccc-cccc-cccccccccccc', date '2024-01-06'));
select 'W1c Minggu = hari 7: ' || (select minggu || '/' || hari from schedule_posisi('cccccccc-cccc-cccc-cccc-cccccccccccc', date '2024-01-07'));
select 'W1d Senin minggu 2: ' || (select minggu || '/' || hari from schedule_posisi('cccccccc-cccc-cccc-cccc-cccccccccccc', date '2024-01-08'));
select 'W1e kembali ke minggu 1 setelah 4 minggu: ' || (select minggu || '/' || hari from schedule_posisi('cccccccc-cccc-cccc-cccc-cccccccccccc', date '2024-01-29'));
select 'W1f sebelum patokan (mundur) minggu 4: ' || (select minggu || '/' || hari from schedule_posisi('cccccccc-cccc-cccc-cccc-cccccccccccc', date '2023-12-25'));

-- ===== J2. awal siklus per cabang =====
set role authenticated; select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false) \gset
\echo --- W2 MDS mengatur awal siklus (harus ditolak):
select schedule_set_start('cccccccc-cccc-cccc-cccc-cccccccccccc', date '2026-11-02');
select set_config('request.jwt.claim.sub','ffffffff-ffff-ffff-ffff-ffffffffffff',false) \gset
\echo --- W3 RMDM cabang lain mengatur awal siklus (harus ditolak):
select schedule_set_start('cccccccc-cccc-cccc-cccc-cccccccccccc', date '2026-11-02');
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false) \gset
\echo --- W4 awal siklus bukan Senin (harus ditolak):
select schedule_set_start('cccccccc-cccc-cccc-cccc-cccccccccccc', date '2026-11-03');
select schedule_set_start('cccccccc-cccc-cccc-cccc-cccccccccccc', date '2026-11-02');
reset role;
select 'W5 awal siklus 2026-11-02: Rabu 11 Nov = ' || (select minggu || '/' || hari from schedule_posisi('cccccccc-cccc-cccc-cccc-cccccccccccc', date '2026-11-11'));
select 'W6 audit ATUR_SIKLUS_JADWAL: ' || count(*) from audit_log where action = 'ATUR_SIKLUS_JADWAL';

-- Untuk uji "hari ini", posisi dikunci ke Minggu 1 hari Selasa (agar hasil tidak bergantung pada hari uji dijalankan)
create or replace function schedule_posisi(p_cabang uuid, p_tgl date default null) returns table (minggu int, hari int)
language sql stable as $$ select 1, 2 $$;

-- ===== K. wewenang mengisi jadwal =====
set role authenticated; select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
\echo --- W7 frontliner mengisi jadwalnya sendiri (harus ditolak):
select schedule_tambah('44444444-4444-4444-4444-444444444444', 1, 2, 1);
\echo --- W8 insert langsung ke tabel tanpa fungsi (harus ditolak):
insert into schedule_taskforce (frontliner_id, minggu, hari, rayon) values ('44444444-4444-4444-4444-444444444444', 1, 2, 1);
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false) \gset
\echo --- W9 insert langsung oleh MDS (harus ditolak):
insert into schedule_taskforce (frontliner_id, minggu, hari, rayon) values ('44444444-4444-4444-4444-444444444444', 1, 2, 1);
select schedule_tambah('44444444-4444-4444-4444-444444444444', 1, 2, 1);
select schedule_tambah('44444444-4444-4444-4444-444444444444', 1, 3, 2);
select schedule_tambah('44444444-4444-4444-4444-444444444444', 4, 6, 3);
select schedule_tambah('44444444-4444-4444-4444-444444444444', 1, 2, 1);
\echo --- W10 rayon 25 (harus ditolak):
select schedule_tambah('44444444-4444-4444-4444-444444444444', 1, 2, 25);
\echo --- W11 hari Minggu (harus ditolak):
select schedule_tambah('44444444-4444-4444-4444-444444444444', 1, 7, 1);
\echo --- W12 minggu ke 5 (harus ditolak):
select schedule_tambah('44444444-4444-4444-4444-444444444444', 5, 1, 1);
reset role;
select 'W13 jadwal F1 (rayon yang sama di hari yang sama tidak digandakan): ' || count(*) from schedule_taskforce where frontliner_id = '44444444-4444-4444-4444-444444444444';

-- ===== L. kunci jadwal =====
set role authenticated; select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false) \gset
\echo --- W14 MDS mengunci (harus ditolak):
select schedule_kunci('44444444-4444-4444-4444-444444444444', true);
select set_config('request.jwt.claim.sub','ffffffff-ffff-ffff-ffff-ffffffffffff',false) \gset
\echo --- W15 RMDM cabang lain mengunci (harus ditolak):
select schedule_kunci('44444444-4444-4444-4444-444444444444', true);
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false) \gset
\echo --- W16 mengunci jadwal yang masih kosong (harus ditolak):
select schedule_kunci('55555555-5555-5555-5555-555555555555', true);
select schedule_kunci('44444444-4444-4444-4444-444444444444', true);
select schedule_kunci('44444444-4444-4444-4444-444444444444', true);
reset role;
select 'W17 F1 terkunci: ' || schedule_locked from profiles where id = '44444444-4444-4444-4444-444444444444';
select 'W18 audit KUNCI_JADWAL (mengunci dua kali hanya tercatat sekali): ' || count(*) from audit_log where action = 'KUNCI_JADWAL';

-- ===== M. layar frontliner dan penjagaan check-in =====
set role authenticated; select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
select 'W19 jadwal_hari_ini F1: ' || jadwal_hari_ini()::text;
select 'W20 F1 hanya melihat jadwalnya sendiri: ' || count(*) || ' baris, ' || count(distinct frontliner_id) || ' frontliner' from schedule_taskforce;
select checkin(:oa,null,null,null) as v1 \gset
select checkout(:'v1');
\echo --- W21 check-in di rayon lain saat terkunci (harus ditolak):
select checkin(:o2,null,null,null);
reset role;
select 'W22 kunjungan F1 tercatat hanya yang di rayon jadwal: ' || count(*) from visits where frontliner_id = '44444444-4444-4444-4444-444444444444' and outlet_id = :o2;

create or replace function schedule_posisi(p_cabang uuid, p_tgl date default null) returns table (minggu int, hari int)
language sql stable as $$ select 1, 5 $$;
set role authenticated; select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
select 'W23 jadwal_hari_ini F1 saat tidak ada jadwal: ' || jadwal_hari_ini()::text;
\echo --- W24 terkunci dan hari ini tanpa jadwal (harus ditolak):
select checkin(:oa,null,null,null);
reset role;

-- ===== N. buka kunci, rayon terakhir, dan frontliner yang tidak terkunci =====
set role authenticated; select set_config('request.jwt.claim.sub','eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',false) \gset
select schedule_tambah('55555555-5555-5555-5555-555555555555', 2, 1, 1) as jf2 \gset
select schedule_kunci('55555555-5555-5555-5555-555555555555', true);
\echo --- W25 melepas rayon terakhir saat terkunci (harus ditolak):
select schedule_lepas(:'jf2');
select schedule_kunci('55555555-5555-5555-5555-555555555555', false);
select schedule_lepas(:'jf2');
reset role;
select 'W26 RMDM mengunci lalu membuka kunci F2, jadwal F2 kosong lagi: ' || count(*) || ', terkunci=' || (select schedule_locked from profiles where id = '55555555-5555-5555-5555-555555555555') from schedule_taskforce where frontliner_id = '55555555-5555-5555-5555-555555555555';
select 'W27 audit BUKA_KUNCI_JADWAL: ' || count(*) from audit_log where action = 'BUKA_KUNCI_JADWAL';
set role authenticated; select set_config('request.jwt.claim.sub','55555555-5555-5555-5555-555555555555',false) \gset
select checkin(:ob,null,null,null) as v2 \gset
reset role;
select 'W28 frontliner tanpa kunci bebas memilih rayon (jadwal kosong, tetap bisa check-in): ' || count(*) from visits where id = :'v2';

-- ===== O. isi urut =====
set role authenticated; select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false) \gset
select 'W29 isi urut untuk F2 kosong: ' || schedule_isi_urut('55555555-5555-5555-5555-555555555555') || ' hari';
select 'W30 isi urut ulang (tidak ada yang kosong): ' || schedule_isi_urut('55555555-5555-5555-5555-555555555555') || ' hari';
select 'W31 isi urut untuk F1 yang sebagian terisi: ' || schedule_isi_urut('44444444-4444-4444-4444-444444444444') || ' hari';
reset role;
select 'W32 R24 jatuh di Minggu 4 Sabtu: ' || minggu || '/' || hari from schedule_taskforce where frontliner_id = '55555555-5555-5555-5555-555555555555' and rayon = 24;
select 'W33 tiap rayon hanya sekali pada F2: ' || count(*) || ' baris, ' || count(distinct rayon) || ' rayon berbeda' from schedule_taskforce where frontliner_id = '55555555-5555-5555-5555-555555555555';

-- ===== P. siapa melihat apa =====
set role authenticated;
select set_config('request.jwt.claim.sub','55555555-5555-5555-5555-555555555555',false) \gset
select 'W34 F2 melihat: ' || count(*) || ' baris dari ' || count(distinct frontliner_id) || ' frontliner' from schedule_taskforce;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false) \gset
select 'W35 TL melihat bawahannya: ' || count(distinct frontliner_id) || ' frontliner' from schedule_taskforce;
select set_config('request.jwt.claim.sub','ffffffff-ffff-ffff-ffff-ffffffffffff',false) \gset
select 'W36 RMDM cabang lain melihat: ' || count(*) from schedule_taskforce;
reset role;

-- ===== Q. frontliner terkunci tidak bisa menembus kunci dengan memindahkan outlet ke rayon jadwal =====
set role authenticated; select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
\echo --- Q1 frontliner terkunci memindahkan outlet ke rayon lain (harus ditolak):
update outlets set rayon = 1 where id = :o2;
update outlets set address = 'alamat baru' where id = :o2;
reset role;
select 'W37 outlet tetap di R' || rayon || ', alamat boleh diubah: ' || address from outlets where id = :o2;
set role authenticated; select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false) \gset
update outlets set rayon = 4 where id = :o2;
reset role;
select 'W38 MDM boleh memindahkan rayon: R' || rayon from outlets where id = :o2;
