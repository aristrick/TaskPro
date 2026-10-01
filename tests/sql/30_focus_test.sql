\set QUIET on
\pset format unaligned
\pset tuples_only on
select id as oa from outlets where name='Outlet A' \gset
update visits set checkout_at = now() where checkout_at is null;
-- Peralihan: tanda fokus global lama -> project yang sudah ada + riwayat penjualan
update products set is_focus = true where product = 'P2';
insert into projects(cabang_id,name) values ('cccccccc-cccc-cccc-cccc-cccccccccccc','PF');
select id as pf from projects where name='PF' \gset

set role authenticated; select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false) \gset
select project_set_member('44444444-4444-4444-4444-444444444444', :'pf');
insert into project_focus values (:'pf','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select 'F1 MDS menetapkan P1 sebagai fokus project PF: berhasil';
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
select 'F2 frontliner di PF membaca fokus project-nya: ' || count(*) from project_focus;
select checkin(:oa,null,null,null) as v1 \gset
select save_sales(:'v1','[{"product_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","qty":2},{"product_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","qty":3}]',null,null,null);
select checkout(:'v1');
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false) \gset
select 'F3 cap fokus penjualan (P1 harus true, P2 false): ' || string_agg(pr.product || '=' || s.is_focus, ', ' order by pr.product) from sales s join products pr on pr.id=s.product_id where s.visit_id=:'v1';
-- ganti fokus: P2 jadi fokus, P1 dilepas
insert into project_focus values (:'pf','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
delete from project_focus where project_id=:'pf' and product_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
select checkin(:oa,null,null,null) as v2 \gset
select save_sales(:'v2','[{"product_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","qty":1},{"product_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","qty":1}]',null,null,null);
select checkout(:'v2');
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false) \gset
select 'F4 kunjungan baru (P1 false, P2 true): ' || string_agg(pr.product || '=' || s.is_focus, ', ' order by pr.product) from sales s join products pr on pr.id=s.product_id where s.visit_id=:'v2';
select 'F5 riwayat kunjungan lama tetap (P1 true, P2 false): ' || string_agg(pr.product || '=' || s.is_focus, ', ' order by pr.product) from sales s join products pr on pr.id=s.product_id where s.visit_id=:'v1';
select set_config('request.jwt.claim.sub','55555555-5555-5555-5555-555555555555',false) \gset
select 'F6 frontliner tanpa project membaca fokus: ' || count(*) from project_focus;
select set_config('request.jwt.claim.sub','66666666-6666-6666-6666-666666666666',false) \gset
\echo --- F7 MDS cabang lain menambah fokus ke project 0300 (harus ditolak):
insert into project_focus values (:'pf','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
\echo --- F8 frontliner menulis project_focus langsung (harus ditolak):
insert into project_focus values (:'pf','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
