\set QUIET on
\pset format unaligned
\pset tuples_only on
select id as oa from outlets where name='Outlet A' \gset
select (now() at time zone 'Asia/Jakarta')::date as today \gset
update visits set checkout_at = now() where checkout_at is null;
select 'V1 indeks baru ada (harus 4): ' || count(*) from pg_indexes where indexname in ('visits_fl_time_idx','sales_visit_idx','visits_outlet_idx','sales_product_idx');
update cabang set tz='Asia/Jayapura' where kode='0400';
select 'V2 zona waktu 0400=' || cabang_tz('dddddddd-dddd-dddd-dddd-dddddddddddd') || ', 0300=' || cabang_tz('cccccccc-cccc-cccc-cccc-cccccccccccc');
\echo --- V3 zona waktu tidak valid (harus ditolak):
update cabang set tz='Europe/Paris' where kode='0400';

-- bukti lokasi & penanda mencurigakan
set role authenticated; select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
select checkin(:oa,-6.2,106.9,0) as va \gset
select checkout(:'va');
select checkin(:oa,0,0,10) as vb \gset
select checkout(:'vb');
select checkin(:oa,-6.2,106.9,15) as vc \gset
select checkout(:'vc');
reset role;
select 'V4 akurasi 0: suspect=' || suspect || ' | ' || suspect_reason from visits where id=:'va';
select 'V5 lompatan jauh: suspect=' || suspect || ' | ' || suspect_reason from visits where id=:'vb';
select 'V6 jarak tercatat (harus 0 m): ' || round(checkin_dist::numeric) || ', akurasi ' || checkin_acc from visits where id=:'va';
select 'V6b kunjungan wajar tidak ditandai (kunjungan c punya lompatan dari b, jadi true): ' || suspect from visits where id=:'vc';
set role authenticated; select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false) \gset
select 'V7 MDS melihat kunjungan mencurigakan: ' || count(*) from visits where suspect;
select set_config('request.jwt.claim.sub','55555555-5555-5555-5555-555555555555',false) \gset
select 'V8 frontliner lain melihat kunjungan mencurigakan F1: ' || count(*) from visits where suspect;
reset role;

-- audit
delete from audit_log;
set role authenticated; select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false) \gset
update outlets set name='Outlet A2' where id=:oa;
update outlets set name='Outlet A' where id=:oa;
select 'V9 MDS membaca audit (harus 0): ' || count(*) from audit_log;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false) \gset
update settings set value='true' where key='radius_enforced';
update settings set value='false' where key='radius_enforced';
select 'V10 MDM membaca audit: ' || count(*) from audit_log;
reset role;
select 'V11 perubahan outlet tercatat: ' || (detail -> 'name' ->> 'dari') || ' -> ' || (detail -> 'name' ->> 'ke') || ' oleh ' || actor_user_id from audit_log where tabel='outlets' order by id limit 1;
select 'V12 pengaturan tercatat: ' || row_id || ' ' || (detail -> 'value' ->> 'dari') || ' -> ' || (detail -> 'value' ->> 'ke') from audit_log where tabel='settings' order by id limit 1;

-- pindah outlet massal
insert into outlets(cabang_id,name,address,lat,long,kode_md,rayon) values
 ('cccccccc-cccc-cccc-cccc-cccccccccccc','Outlet C','c',-6.2,106.9,'0300-TMTB01',2),
 ('cccccccc-cccc-cccc-cccc-cccccccccccc','Outlet D','d',-6.2,106.9,'0300-TMTB01',3);
select code as codec from outlets where name='Outlet C' \gset
delete from audit_log where tabel='outlets' and action='INSERT';
set role authenticated; select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false) \gset
select 'V13 hitung outlet TMTB01 rayon 2 (harus 1): ' || outlet_pindah('0300-TMTB01','0300-TMTB05',2,true);
select 'V14 pindah rayon 2: ' || outlet_pindah('0300-TMTB01','0300-TMTB05',2,false) || ' outlet';
reset role;
select 'V15 Outlet C kini milik ' || kode_md || ', kode outlet tetap: ' || (code = :'codec') from outlets where name='Outlet C';
select 'V16 Outlet D tidak ikut pindah (rayon 3): ' || kode_md from outlets where name='Outlet D';
select 'V17 audit pindah satu ringkasan: ' || (detail ->> 'jumlah') from audit_log where action='PINDAH_OUTLET';
select 'V18 audit UPDATE outlet tidak membanjir (harus 2): ' || count(*) from audit_log where tabel='outlets' and action='UPDATE';
set role authenticated; select set_config('request.jwt.claim.sub','66666666-6666-6666-6666-666666666666',false) \gset
\echo --- V19 MDS cabang lain memindahkan outlet cabang 0300 (harus ditolak):
select outlet_pindah('0300-TMTB05','0300-TMTB01',null,false);
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false) \gset
\echo --- V20 tujuan bukan frontliner (harus ditolak):
select outlet_pindah('0300-TMTB05','0300-TL01',null,true);
reset role;

-- stok oleh MDS
select 'V21 terjual P1 hari ini oleh F1: ' || coalesce(sum(s.qty),0) as info from sales s join visits v on v.id=s.visit_id where v.frontliner_id='44444444-4444-4444-4444-444444444444' and s.product_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and (v.checkin_at at time zone 'Asia/Jakarta')::date = :'today'::date;
set role authenticated; select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false) \gset
\echo --- V22 MDS koreksi di bawah yang terjual (harus ditolak):
select stok_koreksi_admin('44444444-4444-4444-4444-444444444444','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',:'today','0','uji koreksi');
\echo --- V23 tanpa alasan (harus ditolak):
select stok_koreksi_admin('44444444-4444-4444-4444-444444444444','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',:'today','100','');
select stok_koreksi_admin('44444444-4444-4444-4444-444444444444','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',:'today','100','salah hitung pagi');
select 'V24 laporan stok F1/P1 (dibawa/terjual): ' || dibawa || '/' || terjual from stok_laporan(:'today'::date,:'today'::date,null,'44444444-4444-4444-4444-444444444444') where product_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select set_config('request.jwt.claim.sub','66666666-6666-6666-6666-666666666666',false) \gset
\echo --- V25 MDS cabang lain mengoreksi stok (harus ditolak):
select stok_koreksi_admin('44444444-4444-4444-4444-444444444444','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',:'today','200','coba');
select 'V26 MDS cabang lain melihat laporan stok F1 (harus 0): ' || count(*) from stok_laporan(:'today'::date,:'today'::date,null,'44444444-4444-4444-4444-444444444444');
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
\echo --- V27 frontliner memakai koreksi admin (harus ditolak):
select stok_koreksi_admin('44444444-4444-4444-4444-444444444444','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',:'today','999','curang');
reset role;
select 'V28 audit koreksi stok: ' || (detail ->> 'dari') || ' -> ' || (detail ->> 'ke') || ' alasan: ' || (detail ->> 'alasan') from audit_log where action='KOREKSI_STOK';
select 'V29 koreksi admin tidak dobel di audit (harus 0 baris INSERT/UPDATE biasa): ' || count(*) from audit_log where tabel='carry_stock' and action <> 'KOREKSI_STOK';

-- rekap SQL
set role authenticated; select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false) \gset
select 'V30 rekap_harian cocok dengan jumlah langsung: ' || (((rekap_harian(now() - interval '3 day', now() + interval '1 day') -> :'today' ->> 'value')::numeric) = (select coalesce(sum(s.value),0) from sales s join visits v on v.id=s.visit_id join cabang c on c.id=v.cabang_id where (v.checkin_at at time zone c.tz)::date = :'today'::date));
select 'V31 rekap_harian berisi OC, kunjungan, produk: ' || ((rekap_harian(now() - interval '3 day', now() + interval '1 day') -> :'today') ?& array['oc','visits','value','prod']);
select set_config('request.jwt.claim.sub','55555555-5555-5555-5555-555555555555',false) \gset
select 'V32 frontliner lain melihat rekap F1 (harus 0 kunjungan): ' || coalesce((rekap_harian(now() - interval '3 day', now() + interval '1 day') -> :'today' ->> 'visits'), '0');
reset role;

-- log error, kapasitas, pembersihan, cache
set role authenticated; select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
select log_error('boom','stack','/m','UA');
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false) \gset
select 'V33 MDM membaca log error: ' || count(*) from error_log;
select 'V34 kapasitas database terbaca (MB>0): ' || ((db_usage() ->> 'bytes')::bigint > 0) || ', tabel teratas: ' || jsonb_array_length(db_usage() -> 'tabel');
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false) \gset
select 'V35 MDS membaca log error (harus 0): ' || count(*) from error_log;
\echo --- V36 MDS memanggil db_usage (harus ditolak):
select db_usage();
\echo --- V37 pengguna memanggil audit_prune (harus ditolak):
select audit_prune(1);
\echo --- V38 pengguna menulis geocode_cache (harus ditolak):
insert into geocode_cache values (-6.2, 106.9, '{}'::jsonb);
reset role;
select audit_prune(180);
select 'V39 audit_prune oleh pemilik database berjalan';
set role anon;
\echo --- V40 anon memanggil rekap_harian (harus ditolak):
select rekap_harian(now() - interval '1 day', now());
