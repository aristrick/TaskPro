\set QUIET on
\pset format unaligned
\pset tuples_only on
-- ===== seed sebagai superuser =====
insert into auth.users(id,email) values
 ('11111111-1111-1111-1111-111111111111','mdm@x'),('22222222-2222-2222-2222-222222222222','mds@x'),
 ('33333333-3333-3333-3333-333333333333','tl@x'),('44444444-4444-4444-4444-444444444444','f1@x'),('55555555-5555-5555-5555-555555555555','f2@x');
insert into cabang(id,kode,nama,alamat) values ('cccccccc-cccc-cccc-cccc-cccccccccccc','0300','Pulogadung','x');
insert into profiles(id,user_id,nama,role,cabang_id) values
 ('11111111-1111-1111-1111-111111111111','MDM01','MDM','mdm',null),
 ('22222222-2222-2222-2222-222222222222','0300-MDS01','MDS','mds',null),
 ('33333333-3333-3333-3333-333333333333','0300-TL01','TL','tl','cccccccc-cccc-cccc-cccc-cccccccccccc');
insert into profiles(id,user_id,nama,role,cabang_id,atasan_id) values
 ('44444444-4444-4444-4444-444444444444','0300-TMTB01','F1','frontliner','cccccccc-cccc-cccc-cccc-cccccccccccc','33333333-3333-3333-3333-333333333333'),
 ('55555555-5555-5555-5555-555555555555','0300-TMTB05','F2','frontliner','cccccccc-cccc-cccc-cccc-cccccccccccc','33333333-3333-3333-3333-333333333333');
update cabang set mds_id='22222222-2222-2222-2222-222222222222';
insert into outlets(cabang_id,name,address,lat,long,kode_md,rayon) values
 ('cccccccc-cccc-cccc-cccc-cccccccccccc','Outlet A','a',-6.2,106.9,'0300-TMTB01',1),
 ('cccccccc-cccc-cccc-cccc-cccccccccccc','Outlet B','b',-6.2,106.9,'0300-TMTB05',1);
insert into products(id,product,price) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','P1',1000),('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','P2',2000);
update settings set value='false' where key='radius_enforced';
select 'T0 kode outlet & Outlet ID: ' || string_agg(code || ' / ' || ext_id, ' | ' order by name) from outlets;
select id as oa from outlets where name='Outlet A' \gset

-- ===== A. hak eksekusi =====
set role anon;
\echo T1 anon cek_radius:
select cek_radius(:oa,0,0,0);
\echo T2 anon checkin:
select checkin(:oa,0,0,0);
reset role;
set role authenticated; select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
\echo T3 authenticated cek_radius langsung:
select cek_radius(:oa,0,0,0);
reset role;

-- ===== B. baca outlet =====
\echo --- T4 outlet terlihat per role
set role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
select 'frontliner F1 melihat: ' || coalesce(string_agg(name, ','), '(kosong)') from outlets;
select set_config('request.jwt.claim.sub','55555555-5555-5555-5555-555555555555',false) \gset
select 'frontliner F2 melihat: ' || coalesce(string_agg(name, ','), '(kosong)') from outlets;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false) \gset
select 'MDS melihat: ' || string_agg(name, ',' order by name) from outlets;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false) \gset
select 'TL melihat: ' || string_agg(name, ',' order by name) from outlets;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false) \gset
select 'MDM melihat: ' || string_agg(name, ',' order by name) from outlets;
reset role;

-- ===== C. stok pembawaan sebagai F1 =====
set role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
select checkin(:oa,null,null,null) as v1 \gset
\echo --- T5 jual 5 tanpa stok (harus ditolak):
select save_sales(:'v1','[{"product_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","qty":5}]',null,null,null);
select stok_tambah('[{"product_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","qty":10}]');
select 'T6 stok setelah tambah 10: ' || string_agg(dibawa || ' dibawa / ' || terjual || ' terjual', '') from stok_hari_ini();
select stok_tambah('[{"product_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","qty":2}]');
select 'T7 tambah lagi 2 (kumulatif, harus 12): ' || string_agg(dibawa::text, '') from stok_hari_ini();
select stok_koreksi('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',10);
select save_sales(:'v1','[{"product_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","qty":6}]',null,null,null);
select checkout(:'v1');
select checkin(:oa,null,null,null) as v2 \gset
\echo --- T8 kunjungan ke-2 jual 5 (sisa 4, harus ditolak):
select save_sales(:'v2','[{"product_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","qty":5}]',null,null,null);
select save_sales(:'v2','[{"product_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","qty":4}]',null,null,null);
select save_sales(:'v2','[{"product_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","qty":4}]',null,null,null);
select 'T9 simpan ulang qty 4 di kunjungan yang sama (tidak dobel), total kunjungan-2: ' || sum(qty) from sales where visit_id = :'v2';
\echo --- T10 ubah jadi 5 (ditolak) lalu cek data lama utuh:
select save_sales(:'v2','[{"product_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","qty":5}]',null,null,null);
select 'T10b penjualan kunjungan-2 setelah penolakan (harus tetap 4): ' || sum(qty) from sales where visit_id = :'v2';
select 'T11 stok_hari_ini(exclude v2): ' || string_agg(dibawa || ' dibawa / ' || terjual || ' terjual', '') from stok_hari_ini(:'v2');
select 'T11b stok_hari_ini(): ' || string_agg(dibawa || ' dibawa / ' || terjual || ' terjual', '') from stok_hari_ini();
\echo --- T12 koreksi ke 9 (< terjual 10, harus ditolak):
select stok_koreksi('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',9);
select stok_koreksi('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',13);
select 'T12b dibawa setelah koreksi 13: ' || string_agg(dibawa::text, '') from stok_hari_ini();
\echo --- T13 tulis carry_stock langsung (harus ditolak):
insert into carry_stock(frontliner_id,stock_date,product_id,qty) values ('44444444-4444-4444-4444-444444444444',current_date,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',999);
select checkout(:'v2');
select 'T14 kunjungan-2 effective: ' || effective from visits where id = :'v2';

-- ===== D. visibilitas stok =====
select set_config('request.jwt.claim.sub','55555555-5555-5555-5555-555555555555',false) \gset
select 'T15 F2 melihat carry_stock milik F1: ' || count(*) from carry_stock;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false) \gset
select 'T16 MDS melihat carry_stock cabangnya: ' || count(*) from carry_stock;
\echo --- T17 MDS memanggil stok_tambah (harus ditolak):
select stok_tambah('[{"product_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","qty":1}]');
reset role;

-- ===== E. MDM mematikan aturan stok =====
update settings set value='false' where key='stok_enforced';
set role authenticated; select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
select checkin(:oa,null,null,null) as v3 \gset
select save_sales(:'v3','[{"product_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","qty":50}]',null,null,null);
select 'T18 aturan stok dimatikan: jual 50 tanpa stok tersimpan = ' || sum(qty) from sales where visit_id = :'v3';
