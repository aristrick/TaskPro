-- Migrasi 02: menyesuaikan tabel outlets dengan format DMP. Jalankan sekali di SQL Editor.
alter table outlets drop column outlet_category_id, drop column outlet_account_id;
alter table outlets
  add column category text, add column account text,       -- teks: General Trade, Warung Kopi, dst
  add column ext_id text,                                   -- ID acak dari sumber (kolom "code outlet" di DMP)
  add column kode_md text,                                  -- pemilik outlet = User ID frontliner, mis. 0300-TMTB01
  add column cycle text, add column district text, add column profile_outlet text,
  add column status text not null default 'AKTIF',
  add unique (cabang_id, ext_id);                           -- upload ulang tidak menggandakan
alter table outlets alter column lat drop not null, alter column long drop not null; -- boleh belum ada lokasi
create index on outlets (cabang_id, kode_md, rayon);
