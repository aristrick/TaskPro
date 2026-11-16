# Tracking Go di TaskPro

Menu **Tracking Go** (grup baru di sidebar) berisi tiga halaman: **Back Tracking**, **OTJ**, dan **Riwayat**. Isinya sama dengan aplikasi Tracking Go,
tetapi **tanpa upload data**: kunjungan, penjualan, outlet (termasuk koordinat dan tanggal dibuat), dan frontliner dibaca langsung dari TaskPro.
Aplikasi Tracking Go (Firebase) tidak lagi dibutuhkan untuk fitur ini. Data lamanya tidak ikut dipindahkan.

## Pasang
Jalankan `22_migration.sql` sekali di Supabase > SQL Editor (aman diulang, hanya menambah). Tanpa migrasi ini ketiga halaman menampilkan petunjuk menjalankannya dan tidak ada data yang rusak.

## Siapa bisa apa
| Peran | Back Tracking, OTJ, Riwayat |
|---|---|
| MDM | semua cabang; boleh menghapus riwayat |
| RMDM | cabang yang dicover; boleh menghapus riwayat cabangnya |
| MDS | cabangnya |
| TL, Kormot | hanya frontliner bawahannya (sama seperti aturan baca kunjungan di TaskPro) |
| Frontliner | tidak punya akses (diarahkan ke layar HP) |

Aturan ini dijaga di database (RLS dan fungsi), bukan hanya di tampilan.

## Back Tracking
- Pilih **frontliner** dan **tanggal**. Satu hari = **Mode Rute**: urutan kunjungan menurut jam check-in, tiap stop menampilkan alamat, check-in/out, tanggal outlet dibuat,
  **durasi kunjungan**, **selisih dari outlet sebelumnya** (check-out sebelumnya sampai check-in ini; "tumpang tindih" bila negatif; "Check-out beda hari" bila lupa check-out), rincian penjualan, jarak dari Anda, dan tombol Buka Maps.
  Beberapa hari (maksimal 92) = **ringkasan per outlet** (jumlah kunjungan, total penjualan).
- Ketuk nama outlet untuk **konfirmasi**: toko ada?, penjualan sesuai?, empat indikator (Jam Kunjungan Toko Pertama, On Rayon, Kunjungan manual, PV ≤ 1) berstatus Sesuai/TS/N/A + keterangan, temuan lain, hasil diskusi.
  Indikator Jam Kunjungan otomatis N/A untuk toko selain yang pertama.
- **Wajib di dekat outlet (maksimal 50 m).** Jarak dihitung **di database** dari koordinat outlet dan titik GPS perangkat (toleransi akurasi GPS maksimal 30 m, sama seperti check-in), jadi tidak bisa diakali dari aplikasi. Outlet tanpa koordinat tidak diperiksa jaraknya.
- Satu kunjungan hanya bisa dikonfirmasi **sekali**; hasilnya tidak bisa diubah. Jika keliru, MDM/RMDM menghapusnya di Riwayat lalu diisi ulang.
- **Unduh format Back Track (.xlsx)**: Report Back Tracking Sales dengan tata letak form asli.

## OTJ
Tiga tahap terkunci: **Pra-Kunjungan**, **Selama Kunjungan** (per toko), **Pasca-Kunjungan**; tiap pindah tahap wajib konfirmasi dan tahap sebelumnya tidak bisa diubah.
Tipe **Taskforce** dan **MD GT** dengan checklist template resmi. Yang dinilai dipilih dari **akun frontliner TaskPro**; pilihan toko menampilkan outlet yang **dikunjungi frontliner pada tanggal itu** (dari data kunjungan) lebih dulu, lalu semua outletnya.
Skor = Ya / (terjawab − N/A). Draf yang belum selesai tersimpan di perangkat dan dipulihkan bila halaman dimuat ulang. Hasil bisa diunduh sebagai Excel (juga dari Riwayat).

## Riwayat
Dua tab (Back Tracking dan OTJ), filter cabang dan tanggal, 300 data terbaru, unduh Excel, dan Hapus (MDM/RMDM, tercatat di Jejak Audit).

## Catatan teknis
- Tabel: `backtrack_konfirmasi`, `otj_penilaian`. Tulis hanya lewat fungsi `backtrack_simpan` dan `otj_simpan` (tidak ada kebijakan insert/update langsung). Pengisi dicatat dari akun yang login.
- Bila kunjungan dihapus (Edit Penjualan), konfirmasinya tetap ada sebagai arsip (`visit_id` menjadi kosong).
- Radius 50 m ada di dua tempat: `RADIUS_M` di `lib/trackinggo.ts` (hanya teks/penanda) dan `backtrack_simpan` (yang mengikat). Ubah keduanya bersamaan.
- Id butir OTJ (mis. `kunjungan-3-4`) menjadi kunci jawaban tersimpan: tambahkan butir baru di akhir subbagian, jangan mengubah urutan (`lib/otj-template.ts`).
- Tes: `tests/unit/trackinggo*.test.ts` dan `tests/sql/98_v22_test.sql`.
