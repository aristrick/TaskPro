\set QUIET on
\pset format unaligned
\pset tuples_only on
update visits set checkout_at = now() where checkout_at is null;
select id as oa from outlets where name='Outlet A' \gset

-- ===== data uji: outlet milik TMTB05 =====
insert into outlets(cabang_id,name,address,lat,long,kode_md,rayon) values
 ('cccccccc-cccc-cccc-cccc-cccccccccccc','E1 tanpa riwayat','e',-6.2,106.9,'0300-TMTB05',5),
 ('cccccccc-cccc-cccc-cccc-cccccccccccc','E2 rayon enam','e',-6.2,106.9,'0300-TMTB05',6),
 ('cccccccc-cccc-cccc-cccc-cccccccccccc','E3 punya riwayat','e',-6.2,106.9,'0300-TMTB05',5);
select id as e3 from outlets where name='E3 punya riwayat' \gset
select id as ob from outlets where name='Outlet B' \gset
select 'H0 outlet TMTB05 sebelum: ' || count(*) from outlets where kode_md='0300-TMTB05';
set role authenticated; select set_config('request.jwt.claim.sub','55555555-5555-5555-5555-555555555555',false) \gset
select checkin(:e3,null,null,null) as vh \gset
select save_sales(:'vh','[{"product_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","qty":2}]',null,null,null);
select checkout(:'vh');
reset role;

-- ===== hapus massal =====
set role authenticated; select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false) \gset
select 'H1 hitung rayon 5: ' || outlet_hapus_massal('0300-TMTB05', 5, false, true)::text;
select 'H2 hitung semua rayon: ' || (outlet_hapus_massal('0300-TMTB05', null, false, true) ->> 'outlet');
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false) \gset
\echo --- H3 MDS menghapus massal (harus ditolak):
select outlet_hapus_massal('0300-TMTB05', 5, false, false);
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false) \gset
select 'H4 hapus rayon 5 tanpa riwayat: ' || outlet_hapus_massal('0300-TMTB05', 5, false, false)::text;
reset role;
select 'H5 E1 terhapus, E3 (punya riwayat) tetap: ' || (select count(*) from outlets where name='E1 tanpa riwayat') || '/' || (select count(*) from outlets where name='E3 punya riwayat');
select 'H6 arsip berisi E1: ' || count(*) from outlet_arsip where data ->> 'name' = 'E1 tanpa riwayat';
-- kunjungan berjalan memblokir
set role authenticated; select set_config('request.jwt.claim.sub','55555555-5555-5555-5555-555555555555',false) \gset
select checkin(:ob,null,null,null) as vo \gset
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false) \gset
\echo --- H7 ada kunjungan berjalan (harus ditolak):
select outlet_hapus_massal('0300-TMTB05', null, true, false);
select set_config('request.jwt.claim.sub','55555555-5555-5555-5555-555555555555',false) \gset
select checkout(:'vo');
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false) \gset
select 'H8 hapus rayon 5 DENGAN riwayat: ' || outlet_hapus_massal('0300-TMTB05', 5, true, false)::text;
reset role;
select 'H9 E3, kunjungannya, dan penjualannya hilang: ' || (select count(*) from outlets where name='E3 punya riwayat') || '/' || (select count(*) from visits where id=:'vh') || '/' || (select count(*) from sales where visit_id=:'vh');
select 'H10 outlet rayon lain tetap ada (E2): ' || count(*) from outlets where name='E2 rayon enam';
set role authenticated; select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false) \gset
select 'H11 hapus SEMUA outlet TMTB05 (tanpa pilih rayon): ' || outlet_hapus_massal('0300-TMTB05', null, true, false)::text;
\echo --- H12 tidak ada lagi yang cocok (harus ditolak):
select outlet_hapus_massal('0300-TMTB05', null, true, false);
\echo --- H13 Kode MD kosong (harus ditolak):
select outlet_hapus_massal('', null, false, false);
select 'H14 MDM membaca arsip: ' || count(*) from outlet_arsip;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false) \gset
select 'H15 MDS membaca arsip (harus 0): ' || count(*) from outlet_arsip;
reset role;
select 'H16 outlet TMTB05 sesudah: ' || count(*) from outlets where kode_md='0300-TMTB05';
select 'H17 outlet milik TMTB01 tidak tersentuh (harus >0): ' || (count(*) > 0) from outlets where kode_md='0300-TMTB01';
select 'H18 audit hapus massal: ' || count(*) || ' catatan, terakhir ' || (select (detail ->> 'outlet_dihapus') || ' outlet / ' || (detail ->> 'kunjungan_dihapus') || ' kunjungan' from audit_log where action='HAPUS_MASSAL_OUTLET' order by id desc limit 1) from audit_log where action='HAPUS_MASSAL_OUTLET';

-- ===== edit kunjungan / penjualan =====
set role authenticated; select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false) \gset
select checkin(:oa,null,null,null) as vk \gset
select save_sales(:'vk','[{"product_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","qty":2}]',null,null,null);
select checkout(:'vk');
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false) \gset
select (date_trunc('minute', now()) - interval '40 days') as t0 \gset
select (date_trunc('minute', now()) - interval '40 days' + interval '9 minutes') as t1 \gset
select kunjungan_edit(:'vk', :'t0', :'t1', '[{"product_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","qty":5,"price":1500},{"product_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","qty":1}]', 'koreksi tanggal dan produk');
reset role;
select 'E1 baris penjualan setelah edit: ' || string_agg(pr.product || ' x' || s.qty || ' @' || s.price || ' =' || s.value || ' fokus=' || s.is_focus, ' | ' order by pr.product) from sales s join products pr on pr.id=s.product_id where s.visit_id=:'vk';
select 'E2 tanggal bergeser 40 hari, check-out 9 menit setelah check-in: ' || ((checkout_at - checkin_at) = interval '9 minutes') || ', effective=' || effective from visits where id=:'vk';
select 'E3 audit EDIT_PENJUALAN: ' || (detail ->> 'alasan') || ' | lama ' || (detail -> 'lama' -> 'penjualan' -> 0 ->> 'qty') || ' pcs -> baru ' || jsonb_array_length(detail -> 'baru' -> 'penjualan') || ' baris' from audit_log where action='EDIT_PENJUALAN' order by id desc limit 1;
set role authenticated; select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false) \gset
select 'E4 rekap pada tanggal baru (harus 8500): ' || ((rekap_harian((:'t0'::timestamptz - interval '2 days'), (:'t0'::timestamptz + interval '2 days')) -> to_char(:'t0'::timestamptz at time zone 'Asia/Jakarta', 'YYYY-MM-DD')) ->> 'value');
\echo --- E5 alasan kosong (harus ditolak):
select kunjungan_edit(:'vk', :'t0', :'t1', '[]', '');
\echo --- E6 check-out sebelum check-in (harus ditolak):
select kunjungan_edit(:'vk', :'t1', :'t0', '[]', 'uji');
\echo --- E7 produk dobel (harus ditolak):
select kunjungan_edit(:'vk', :'t0', :'t1', '[{"product_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","qty":1},{"product_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","qty":2}]', 'uji');
\echo --- E8 jumlah nol (harus ditolak):
select kunjungan_edit(:'vk', :'t0', :'t1', '[{"product_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","qty":0}]', 'uji');
\echo --- E9 waktu di masa depan (harus ditolak):
select kunjungan_edit(:'vk', now() + interval '3 days', now() + interval '3 days', '[]', 'uji');
select 'E10 penolakan tadi tidak mengubah data (penjualan tetap 2 baris): ' || count(*) from sales where visit_id=:'vk';
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false) \gset
\echo --- E11 MDS mengedit penjualan (harus ditolak):
select kunjungan_edit(:'vk', :'t0', :'t1', '[]', 'uji');
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false) \gset
select kunjungan_edit(:'vk', :'t0', :'t1', '[]', 'hapus semua baris');
reset role;
select 'E12 semua baris dihapus: baris=' || (select count(*) from sales where visit_id=:'vk') || ', effective=' || (select effective from visits where id=:'vk');
set role anon;
\echo --- E13 anon mengedit (harus ditolak):
select kunjungan_edit(:'vk', :'t0', :'t1', '[]', 'uji');
