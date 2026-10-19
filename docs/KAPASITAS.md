# Kapasitas: 45 frontliner, 7 MDS, 3 RMDM, 2 MDM (57 pengguna) di paket gratis

Diukur dengan simulasi di Postgres uji (satu inti CPU): 45.000 outlet (±1.000 per frontliner), 70.200 kunjungan (2 bulan, 30 kunjungan per frontliner per hari),
±246.000 baris penjualan, dengan aturan akses (RLS) aktif. Ini **bukan** pengukuran di Supabase Anda; gunakan sebagai gambaran relatif dan ukur ulang setelah beberapa minggu dipakai
(kartu *Penyimpanan database* di Home MDM menunjukkan pertumbuhan nyata).

## Hasil perbaikan performa (migrasi 15)
| Yang diukur | Sebelum | Sesudah |
|---|---|---|
| Home: hitung outlet (MDM) | 474 ms | 4,5 ms |
| Home MDS: hitung outlet | 1.088 ms | 7 ms |
| Stok semua frontliner | 905 ms | 21 ms |
| Report: kunjungan 1 hari | 1.607 ms | 38 ms |
| Cari outlet (MDM) | 540 ms | 44 ms |
| Home: rekap bulan ini (MDM) | 1.352 ms | 287 ms |
| Tab Rekap di HP: waktu | 2.356 ms | 49 ms |
| Tab Rekap di HP: data terkirim | 531 KB | **51 KB** |
| Gelombang serentak (20 frontliner x 8 kunjungan + 6 admin) | 49,4 detik | 7,2 detik |

Penyebabnya: fungsi akses di kebijakan RLS dipanggil sekali per baris. Kini dibungkus agar dihitung sekali per query. Logika akses tidak berubah (86 hasil tes lama identik).

## Perkiraan bulanan (asumsi: 30 kunjungan/frontliner/hari, 26 hari, 3-5 produk per kunjungan)
- **Database** (batas 500 MB): ±22-30 MB per bulan; data awal ±35 MB. Penuh dalam ±15-21 bulan. Jika kunjungan 60/hari, separuhnya.
- **Egress** (batas 5 GB/bulan): ±0,5 MB per frontliner per hari, sekitar 0,6 GB/bulan untuk 45 frontliner. Sebelum perbaikan Rekap ±2,6 GB.
- **Unduhan Report**: ±39 MB per file untuk satu bulan seluruh frontliner (Kunjungan dan Selling masing-masing mengunduh sebanyak itu). 20 unduhan sebulan ≈ 0,8 GB.
- **Beban CPU**: ±45 ms per kunjungan lengkap (check-in, simpan penjualan, check-out). Satu hari penuh (1.350 kunjungan) ±1 menit CPU, tersebar. Jika semua frontliner check-out dalam satu menit, ±2 detik CPU.

## Yang paling dulu bermasalah
1. **Egress** bila Report sebulan penuh diunduh berulang tiap hari oleh banyak admin (12 admin x 30 hari x 39 MB ≈ 14 GB). Unduh per minggu atau sesuai kebutuhan.
2. **Penyimpanan** setelah sekitar 1-2 tahun: ekspor lalu arsipkan data lama (lihat `docs/PAKET-GRATIS.md`).
3. Paket gratis tidak punya backup: pakai `backup.yml` dan uji pemulihannya.
