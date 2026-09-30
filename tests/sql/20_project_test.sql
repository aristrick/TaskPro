\set QUIET on
\pset format unaligned
\pset tuples_only on
insert into auth.users(id,email) values ('66666666-6666-6666-6666-666666666666','mds2@x'),('77777777-7777-7777-7777-777777777777','f3@x');
insert into cabang(id,kode,nama,alamat) values ('dddddddd-dddd-dddd-dddd-dddddddddddd','0400','Cakung','y');
insert into profiles(id,user_id,nama,role) values ('66666666-6666-6666-6666-666666666666','0400-MDS01','MDS2','mds');
insert into profiles(id,user_id,nama,role,cabang_id,atasan_id) values ('77777777-7777-7777-7777-777777777777','0400-TMTB01','F3','frontliner','dddddddd-dddd-dddd-dddd-dddddddddddd','33333333-3333-3333-3333-333333333333');
update cabang set mds_id='66666666-6666-6666-6666-666666666666' where id='dddddddd-dddd-dddd-dddd-dddddddddddd';
update visits set checkout_at = now() where checkout_at is null;
select id as oa from outlets where name='Outlet A' \gset

set role authenticated; select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false) \gset
insert into projects(cabang_id,name) values ('cccccccc-cccc-cccc-cccc-cccccccccccc','Taskforce Beverage Pulogadung Sep 2026');
select 'P1 MDS membuat project di cabangnya: berhasil';
\echo --- P2 MDS membuat project di cabang lain (harus ditolak):
insert into projects(cabang_id,name) values ('dddddddd-dddd-dddd-dddd-dddddddddddd','X');
select id as pid from projects where name like 'Taskforce%' \gset
select project_set_member('44444444-4444-4444-4444-444444444444', :'pid');
select 'P3 anggota F1: ' || coalesce((select p.name from profiles pr join projects p on p.id=pr.project_id where pr.id='44444444-4444-4444-4444-444444444444'),'(kosong)');
\echo --- P4 masukkan F3 (cabang 0400) ke project cabang 0300 (harus ditolak):
select project_set_member('77777777-7777-7777-7777-777777777777', :'pid');
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
\echo --- P5 frontliner memanggil project_set_member (harus ditolak):
select project_set_member('44444444-4444-4444-4444-444444444444', :'pid');
select checkin(:oa,null,null,null) as v \gset
select 'P6 project tercatat pada kunjungan: ' || (project_id is not null) from visits where id=:'v';
select checkout(:'v');
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false) \gset
select project_set_member('44444444-4444-4444-4444-444444444444', null);
select 'P7 project F1 setelah dikeluarkan: ' || coalesce((select project_id::text from profiles where id='44444444-4444-4444-4444-444444444444'),'kosong');
select 'P8 riwayat kunjungan tetap punya project: ' || (project_id is not null) from visits where id=:'v';
\echo --- P9 hapus project yang sudah dipakai kunjungan (harus ditolak):
delete from projects where id=:'pid';
insert into projects(cabang_id,name) values ('cccccccc-cccc-cccc-cccc-cccccccccccc','Temp');
select id as tid from projects where name='Temp' \gset
select project_set_member('44444444-4444-4444-4444-444444444444', :'tid');
delete from projects where id=:'tid';
select 'P10 hapus project tanpa kunjungan, anggota terlepas: ' || coalesce((select project_id::text from profiles where id='44444444-4444-4444-4444-444444444444'),'kosong');
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false) \gset
select 'P11 TL melihat project cabangnya: ' || count(*) from projects;
select set_config('request.jwt.claim.sub','66666666-6666-6666-6666-666666666666',false) \gset
select 'P12 MDS cabang lain melihat project 0300: ' || count(*) from projects where cabang_id='cccccccc-cccc-cccc-cccc-cccccccccccc';
reset role; set role anon;
\echo --- P13 anon memanggil project_set_member (harus ditolak):
select project_set_member('44444444-4444-4444-4444-444444444444', null);
