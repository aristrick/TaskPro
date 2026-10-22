# Versi database dan urutan migrasi

Satu sumber kebenaran agar tidak ragu mana yang perlu dijalankan.

## Aturan singkat

- **Instalasi baru:** jalankan `database.sql`, lalu `16_migration.sql`. File `database.sql` **sudah memuat migrasi 03 sampai 15** (diperiksa otomatis terhadap isi tiap file migrasi), jadi 03 sampai 15 tidak perlu dijalankan lagi.
- **Database yang sudah berjalan:** jalankan hanya migrasi yang belum terpasang, urut dari yang terkecil. Gunakan kolom "Cek terpasang" di bawah untuk memastikan; hasilnya `true` berarti sudah ada.
- Semua migrasi aman dijalankan ulang dan hanya menambah (tidak menghapus atau mengubah data). Migrasi 16 tidak mengubah apa pun yang sudah ada.
- `06b_ubah_data_lama.sql` bersifat **opsional** dan **mengubah data lama** (format kode outlet). Jalankan hanya jika memang ingin memigrasi kode outlet lama, setelah 06 dan sebelum menambah outlet baru.
- `seed_mdm.sql` hanya untuk membuat akun MDM pertama pada instalasi baru.

## Tabel migrasi

| Migrasi | Isi | Sudah di `database.sql` | Cek terpasang (SQL Editor) |
|---|---|---|---|
| 03 | RMDM hanya melihat cabang yang dia cover | ya | `select to_regproc('public.my_cabang_ids') is not null;` |
| 04 | Produk, kunjungan (check-in/out), penjualan, radius 50 m | ya | `select to_regproc('public.jarak_m') is not null;` |
| 05 | Hak edit outlet frontliner, akses kunjungan TL/Kormot | ya | `(tidak ada objek baru; berupa perubahan kebijakan akses)` |
| 06 | Outlet ID acak 9 digit, kode outlet baru, pengecualian GPS | ya | `select to_regproc('public.set_outlet_code') is not null;` |
| 07 | Outlet ID 9 angka acak untuk semua outlet (src_id) | ya | `select exists(select 1 from information_schema.columns where table_name='outlets' and column_name='src_id');` |
| 08 | MDS hanya 1 cabang; sesi 1 perangkat dan logout paksa | ya | `select to_regproc('public.sesi_klaim') is not null;` |
| 09 | Fungsi internal tertutup, stok pembawaan harian | ya | `select to_regproc('public.stok_hari_ini') is not null;` |
| 10 | Project (kolom Project di Excel) | ya | `select to_regproc('public.project_set_member') is not null;` |
| 11 | Produk fokus per project | ya | `select to_regproc('public.save_sales') is not null;` |
| 12 | Indeks, zona waktu per cabang, audit, rekap di SQL, log error, pemantau kapasitas | ya | `select to_regproc('public.cabang_tz') is not null;` |
| 13 | Hapus paksa outlet, edit kunjungan/penjualan, arsip outlet | ya | `select to_regproc('public.outlet_hapus_massal') is not null;` |
| 14 | Batas minimal waktu check-in ke check-out | ya | `select to_regproc('public.checkout') is not null;` |
| 15 | Performa RLS dan rekap untuk 45+ frontliner | ya | `select to_regproc('public.rekap_saya') is not null;` |
| 16 | Check-out tertunda untuk sinyal lemah (checkout_tertunda) | tidak | `select to_regproc('public.checkout_tertunda') is not null;` |

## Migrasi 16 (opsional, disarankan untuk frontliner di area sinyal lemah)

Aplikasi tetap berjalan tanpa migrasi ini. Tanpa 16, check-out yang tertunda karena sinyal tetap terkirim otomatis, tetapi jam check-out yang tercatat adalah jam saat terkirim (memakai `checkout()` biasa). Dengan 16, yang tercatat adalah jam saat frontliner menekan tombol. Pagar keamanannya: hanya kunjungan milik sendiri yang masih berjalan, waktu tidak boleh sebelum check-in atau di masa depan, tidak boleh lebih tua dari 48 jam, dan batas minimal check-out dihitung dari waktu yang dikirim.
