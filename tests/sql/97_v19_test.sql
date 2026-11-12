\set QUIET on
\pset format unaligned
\pset tuples_only on
-- Schedule Taskforce (migrasi 19)
-- Pelaku: 1111 MDM, 2222 MDS cabang 0300, 3333 TL, 4444 F1 dan 5555 F2 (cabang 0300), 7777 F3 (cabang 0400), 8888 RMDM yang mencover 0300.
insert into auth.users(id,email) values ('88888888-8888-8888-8888-888888888888','rmdm@x');
insert into profiles(id,user_id,nama,role) values ('88888888-8888-8888-8888-888888888888','0300-RMDM01','RMDM','rmdm');
update cabang set rmdm_id = '88888888-8888-8888-8888-888888888888' where kode = '0300';

set role authenticated; select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false) \gset
insert into schedule_rayon(frontliner_id,minggu,hari,rayon,dibuat_oleh) values
  ('44444444-4444-4444-4444-444444444444',1,1,1,'11111111-1111-1111-1111-111111111111'),
  ('44444444-4444-4444-4444-444444444444',1,2,2,'11111111-1111-1111-1111-111111111111'),
  ('44444444-4444-4444-4444-444444444444',4,6,24,'11111111-1111-1111-1111-111111111111');
select 'G1 MDM mengisi 3 hari jadwal F1: ' || count(*) from schedule_rayon where frontliner_id = '44444444-4444-4444-4444-444444444444';
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
select 'G2 F1 melihat jadwalnya sendiri: ' || count(*) from schedule_rayon;
select set_config('request.jwt.claim.sub','55555555-5555-5555-5555-555555555555',false) \gset
select 'G3 F2 tidak melihat jadwal F1: ' || count(*) from schedule_rayon;

select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false) \gset
insert into schedule_rayon(frontliner_id,minggu,hari,rayon) values ('44444444-4444-4444-4444-444444444444',2,1,3);
select 'G4 MDS (cabang 0300) menambah hari untuk F1: ' || count(*) from schedule_rayon where frontliner_id = '44444444-4444-4444-4444-444444444444';
\echo --- G5 MDS cabang 0300 mengisi jadwal F3 milik cabang 0400 (harus ditolak):
insert into schedule_rayon(frontliner_id,minggu,hari,rayon) values ('77777777-7777-7777-7777-777777777777',1,1,1);
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
\echo --- G6 frontliner mengisi jadwalnya sendiri (harus ditolak):
insert into schedule_rayon(frontliner_id,minggu,hari,rayon) values ('44444444-4444-4444-4444-444444444444',3,3,9);
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false) \gset
\echo --- G7 TL mengisi jadwal bawahannya (harus ditolak):
insert into schedule_rayon(frontliner_id,minggu,hari,rayon) values ('44444444-4444-4444-4444-444444444444',3,3,9);

select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false) \gset
\echo --- G8 hari yang sama diisi dua kali (harus ditolak, satu hari satu rayon):
insert into schedule_rayon(frontliner_id,minggu,hari,rayon) values ('44444444-4444-4444-4444-444444444444',1,1,7);
\echo --- G9 rayon 25 (harus ditolak):
insert into schedule_rayon(frontliner_id,minggu,hari,rayon) values ('44444444-4444-4444-4444-444444444444',3,4,25);
\echo --- G10 hari ke-7 (harus ditolak):
insert into schedule_rayon(frontliner_id,minggu,hari,rayon) values ('44444444-4444-4444-4444-444444444444',3,4,1) , ('44444444-4444-4444-4444-444444444444',3,7,1);
\echo --- G11 minggu ke-5 (harus ditolak):
insert into schedule_rayon(frontliner_id,minggu,hari,rayon) values ('44444444-4444-4444-4444-444444444444',5,1,1);
\echo --- G12 mengisi jadwal untuk akun yang bukan frontliner (harus ditolak):
insert into schedule_rayon(frontliner_id,minggu,hari,rayon) values ('33333333-3333-3333-3333-333333333333',1,1,1);
insert into schedule_rayon(frontliner_id,minggu,hari,rayon) values ('44444444-4444-4444-4444-444444444444',1,1,5) on conflict (frontliner_id,minggu,hari) do update set rayon = excluded.rayon;
select 'G13 mengganti rayon hari yang sama (upsert): minggu 1 Senin = R' || rayon from schedule_rayon where frontliner_id='44444444-4444-4444-4444-444444444444' and minggu=1 and hari=1;
select 'G14 jadwal F1 setelah semua percobaan: ' || count(*) from schedule_rayon where frontliner_id='44444444-4444-4444-4444-444444444444';

select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
with d as (delete from schedule_rayon where frontliner_id = '44444444-4444-4444-4444-444444444444' returning 1) select 'G15 frontliner menghapus jadwalnya sendiri: terhapus ' || count(*) from d;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false) \gset
with d as (delete from schedule_rayon where frontliner_id = '44444444-4444-4444-4444-444444444444' and minggu = 2 returning 1) select 'G16 MDS menghapus satu hari: terhapus ' || count(*) from d;

-- kunci jadwal
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false) \gset
\echo --- G17 MDS mengunci jadwal (harus ditolak):
select schedule_kunci_set('44444444-4444-4444-4444-444444444444', true);
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
\echo --- G18 frontliner mengunci jadwalnya sendiri (harus ditolak):
select schedule_kunci_set('44444444-4444-4444-4444-444444444444', true);
\echo --- G19 frontliner menulis status kunci langsung ke tabel (harus ditolak):
insert into schedule_status(frontliner_id,kunci) values ('44444444-4444-4444-4444-444444444444', false);
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false) \gset
select schedule_kunci_set('44444444-4444-4444-4444-444444444444', true);
\echo --- G20 mengunci akun yang bukan frontliner (harus ditolak):
select schedule_kunci_set('33333333-3333-3333-3333-333333333333', true);
select 'G21 MDM mengunci F1: kunci=' || kunci from schedule_status where frontliner_id='44444444-4444-4444-4444-444444444444';
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
select 'G22 F1 membaca status kuncinya: ' || coalesce((select kunci::text from schedule_status), 'tidak ada');
select set_config('request.jwt.claim.sub','55555555-5555-5555-5555-555555555555',false) \gset
select 'G23 F2 tidak melihat status F1: ' || count(*) from schedule_status;
select set_config('request.jwt.claim.sub','88888888-8888-8888-8888-888888888888',false) \gset
select schedule_kunci_set('44444444-4444-4444-4444-444444444444', false);
select 'G24 RMDM (mencover 0300) membuka kunci F1: kunci=' || kunci from schedule_status where frontliner_id='44444444-4444-4444-4444-444444444444';
\echo --- G25 RMDM mengunci F3 di cabang 0400 yang tidak dicover (harus ditolak):
select schedule_kunci_set('77777777-7777-7777-7777-777777777777', true);

reset role;
select 'G26 audit perubahan jadwal: ' || (select string_agg(action || ' ' || n, ', ' order by action) from (select action, count(*) n from audit_log where tabel = 'schedule_rayon' group by action) x);
select 'G27 audit kunci: ' || (select string_agg(action || ' ' || (detail ->> 'frontliner'), ', ' order by id) from audit_log where tabel = 'schedule_status');
set role anon;
\echo --- G28 tanpa login membaca jadwal (harus ditolak):
select count(*) from schedule_rayon;
\echo --- G29 tanpa login memanggil fungsi kunci (harus ditolak):
select schedule_kunci_set('44444444-4444-4444-4444-444444444444', true);
reset role;
select 'G30 tabel lama tidak tersentuh: kolom profiles tetap ' || (select count(*) from information_schema.columns where table_name = 'profiles' and column_name like 'schedule%') || ' kolom schedule';
