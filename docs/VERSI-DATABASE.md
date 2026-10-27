# Versi database dan urutan migrasi

Satu sumber kebenaran agar tidak ragu mana yang perlu dijalankan.

## Aturan singkat

- **Instalasi baru:** jalankan `database.sql`, lalu `16_migration.sql`, `17_migration.sql`, dan `18_migration.sql`. File `database.sql` **sudah memuat migrasi 03 sampai 15** (diperiksa otomatis terhadap isi tiap file migrasi), jadi 03 sampai 15 tidak perlu dijalankan lagi.
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
| 17 | Hapus penjualan khusus MDM (penjualan_hapus) | tidak | `select to_regproc('public.penjualan_hapus') is not null;` |
| 18 | Hapus seluruh kunjungan khusus MDM (kunjungan_hapus) | tidak | `select to_regproc('public.kunjungan_hapus') is not null;` |

## Migrasi 16 (opsional, disarankan untuk frontliner di area sinyal lemah)

Aplikasi tetap berjalan tanpa migrasi ini. Tanpa 16, check-out yang tertunda karena sinyal tetap terkirim otomatis, tetapi jam check-out yang tercatat adalah jam saat terkirim (memakai `checkout()` biasa). Dengan 16, yang tercatat adalah jam saat frontliner menekan tombol. Pagar keamanannya: hanya kunjungan milik sendiri yang masih berjalan, waktu tidak boleh sebelum check-in atau di masa depan, tidak boleh lebih tua dari 48 jam, dan batas minimal check-out dihitung dari waktu yang dikirim.

## Migrasi 17 (wajib jika ingin memakai tombol Hapus di menu Edit Penjualan)

Menambah fungsi `penjualan_hapus`. Tanpa migrasi ini, tombol Hapus menampilkan pesan gagal dari server dan tidak ada data yang berubah. Aturannya: hanya MDM, alasan wajib (minimal 3 huruf), kunjungan harus sudah check-out dan memang punya penjualan. Yang dihapus hanya baris penjualannya: kunjungan tetap ada (jam check-in dan check-out utuh) dan menjadi kunjungan tanpa penjualan. Nilai lama dan alasan dicatat di `audit_log` dengan aksi `HAPUS_PENJUALAN`, jadi bisa dilihat di Pantau > Jejak audit. Stok pembawaan otomatis kembali karena stok dihitung dari penjualan.

## Migrasi 18 (untuk tombol "Hapus seluruh kunjungan" di Edit Penjualan)

Menambah fungsi `kunjungan_hapus`. Menghapus **satu kunjungan beserta seluruh penjualannya** (penjualan ikut terhapus lewat `on delete cascade`). Cocok untuk check-in salah outlet atau kunjungan ganda, termasuk kunjungan yang masih berjalan (frontliner lalu bisa check-in lagi). Aturannya sama dengan migrasi 17: hanya MDM, alasan wajib (minimal 3 huruf), dan seluruh isinya dicatat di `audit_log` dengan aksi `HAPUS_KUNJUNGAN` (termasuk penanda apakah kunjungan masih berjalan). Untuk hanya menghapus penjualan dan mempertahankan kunjungannya, pakai migrasi 17. Tanpa migrasi 18, pilihan ini menampilkan pesan gagal dan tidak ada data yang berubah.
