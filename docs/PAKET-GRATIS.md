# Memakai Supabase paket gratis dengan aman

| Batas paket gratis (per pengecekan terakhir) | Dampak | Yang sudah dilakukan aplikasi |
|---|---|---|
| Database 500 MB | Penuh = database bisa menjadi hanya-baca | Kartu **Penyimpanan database** di Home (MDM) dengan peringatan 70% dan 90%; audit tidak mencatat tiap kunjungan/penjualan/import; pembersihan harian |
| Egress 5 GB/bulan | Terlampaui = layanan dibatasi | Home memakai ringkasan SQL (bukan menarik semua baris); daftar outlet berhalaman; tanpa gambar/foto |
| Proyek dijeda jika tidak aktif seminggu | Aplikasi mati sampai dihidupkan manual | `backup.yml` menyentuh database setiap hari |
| Tidak ada backup otomatis | Data bisa hilang permanen | `backup.yml` + `docs/PEMULIHAN.md` |

Cek angka terbaru di halaman harga Supabase sebelum mengambil keputusan; batas bisa berubah.

## Perkiraan kasar pertumbuhan data
Satu kunjungan beserta ±3 baris penjualan memakan sekitar **1 KB** (termasuk indeks). Itu perkiraan kasar; ukur dengan kartu Penyimpanan di Home.

| Skala | Kunjungan/bulan | Tambahan data/bulan | Perkiraan penuh |
|---|---|---|---|
| 5 frontliner × 20 kunjungan/hari | ±2.600 | ±3 MB | bertahun-tahun |
| 50 frontliner × 40 kunjungan/hari | ±52.000 | ±50 MB | ±9 bulan |
| 100 frontliner × 60 kunjungan/hari | ±156.000 | ±150 MB | ±3 bulan |

## Kapan harus bertindak
- **Penyimpanan > 70%**: ekspor Report bulan-bulan lama, simpan file, lalu hapus data lama (hanya setelah backup terbukti bisa dibuka), atau naikkan paket.
  Hapus per bulan, mis. `delete from visits where checkin_at < '2026-01-01';` (baris penjualannya ikut terhapus otomatis).
- Perlu backup harian terkelola dan pemulihan ke titik waktu tertentu, atau aplikasi dipakai sebagai layanan bisnis inti: pertimbangkan paket berbayar.
- Vercel paket Hobby hanya untuk pemakaian non-komersial; untuk penggunaan perusahaan siapkan paket Pro.

## Layanan alamat gratis (OpenStreetMap)
Server memanggilnya paling cepat sekali per 1,1 detik dan menyimpan hasil per titik (±11 m) di database, sehingga titik yang sama tidak ditanyakan lagi.
Isi `GEOCODE_CONTACT` (email/URL Anda) di Vercel agar aplikasi mengenalkan diri sebagaimana diwajibkan. Untuk skala besar gunakan penyedia berbayar atau pasang layanan sendiri.
