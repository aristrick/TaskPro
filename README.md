# TaskPro
## Instalasi baru
1. Supabase → SQL Editor: jalankan `database.sql` (berisi semua migrasi 01–08).
2. Authentication → Users → Add user `mdm01@taskpro.app` (Auto Confirm), lalu jalankan `seed_mdm.sql`.
3. `.env.example` → `.env.local`, isi 3 nilai (Project Settings → API). Jangan di-commit.
4. `npm install` → `npm run dev`. Login `MDM01`.
## Database yang sudah berjalan
Migrasi 11 (produk fokus per project): jalankan `11_migration.sql`. Migrasi 10 (Project): jalankan `10_migration.sql`. Jalankan hanya migrasi yang belum: `06_migration.sql`, `07_migration.sql`, lalu **`08_migration.sql`** (MDS 1 cabang + sesi perangkat/logout paksa; jika ada MDS yang memegang >1 cabang, hanya cabang berkode terkecil yang dipertahankan) (Outlet ID 9 angka acak untuk semua outlet). Opsional `06b_ubah_data_lama.sql`: ubah kode outlet hasil import lama ke format baru.
## Urutan pemakaian
MDM: Cabang → MDS & RMDM. MDS: Frontliner (TL/Kormot dulu, lalu Frontliner) → Outlet > Import DMP → Produk. Frontliner: buka di HP.
## Deploy (GitHub + Vercel)
1. Buat repo GitHub, push folder ini (`.env.local` sudah masuk .gitignore).
2. vercel.com → Add New Project → pilih repo. Framework Next.js terdeteksi otomatis.
3. Environment Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Deploy.
4. Domain: Project → Settings → Domains. HTTPS otomatis (wajib agar GPS jalan di HP).

## Aturan akun & sesi
- MDS = tepat 1 cabang (wajib dipilih saat membuat akun). RMDM = boleh banyak cabang (diatur MDM).
- Sesi login tersimpan di browser: refresh tidak logout. Logout hanya lewat tombol Log out (dengan konfirmasi) atau logout paksa.
- Frontliner hanya bisa aktif di 1 perangkat. Login dari perangkat lain ditolak selama akunnya aktif (terlihat dalam 10 menit terakhir).
- MDM/RMDM/MDS melihat penanda Aktif di daftar akun dan bisa menekan Logout paksa. Perangkat yang bersangkutan keluar dalam maksimal 45 detik.

## Migrasi 09 (keamanan + stok pembawaan)
Jalankan `09_migration.sql` sekali. Isinya: fungsi internal database tidak lagi bisa dipanggil tanpa login; frontliner hanya membaca outlet
milik Kode MD-nya; dan **stok pembawaan harian** (frontliner: Profile > Tambahkan stok pembawaan). Penjualan tidak bisa melebihi stok yang dibawa
pada hari itu (WIB). MDM bisa mematikan aturan ini dari halaman Home selama masa peralihan.
Draf penjualan tersimpan otomatis di perangkat selama kunjungan berjalan, sehingga tidak hilang jika halaman dimuat ulang.

## Menguji SQL
`pip install pgserver` lalu `python tests/sql/run.py` (Postgres tertanam, tidak menyentuh Supabase Anda).

## Migrasi 12 dan seterusnya (jalankan `12_migration.sql` sekali)
Indeks, zona waktu per cabang (WIB/WITA/WIT), bukti lokasi check-in dan penanda kunjungan mencurigakan, jejak audit, pindah outlet massal,
stok oleh MDS dan laporan stok, rekap harian di SQL, log error, cache alamat, dan pemantau kapasitas. Halaman baru: **Stok**, **Pantau**;
**Project** dan **Cabang** (zona waktu) diperluas; **Outlet** punya "Pindahkan outlet".

## Variabel lingkungan tambahan (Vercel)
- `GEOCODE_CONTACT`: email/URL Anda, dikirim sebagai identitas ke layanan alamat gratis.
- `NEXT_PUBLIC_SITE_URL`: alamat situs (opsional).
- `NEXT_PUBLIC_DB_LIMIT_MB`: batas penyimpanan untuk kartu kapasitas (bawaan 500; ubah jika paket naik).

## Tes, CI, dan backup
- `npm run typecheck` (mode strict), `npm test` (tes unit), `npm run test:sql` (tes aturan database; butuh `pip install pgserver`).
- `.github/workflows/ci.yml` menjalankan semuanya tiap push. `.github/workflows/backup.yml` membuat backup harian: lihat `docs/PEMULIHAN.md`.
- Paket gratis Supabase: lihat `docs/PAKET-GRATIS.md`.

## Pasang di layar HP
Buka situs lewat HTTPS di Chrome Android: menu ⋮ > *Tambahkan ke layar utama*. Di iPhone: Safari > Bagikan > *Tambah ke Layar Utama*.

## Migrasi 13 (jalankan `13_migration.sql` sekali)
- **Hapus paksa outlet frontliner** (khusus MDM): halaman Outlet > *Hapus paksa outlet*. Pilih frontliner dan rayon (kosong = semua). Ada mode aman (outlet yang pernah dikunjungi dilewati)
  dan mode permanen (kunjungan dan penjualannya ikut terhapus), dikunci dengan mengetik Kode MD. Outlet yang dihapus diarsipkan 90 hari dan tercatat di audit.
- **Edit penjualan** (khusus MDM): menu Edit Penjualan. Ubah waktu check-in/check-out dan baris penjualan (produk, pcs, harga). Wajib beralasan; nilai lama dan baru tercatat di Jejak Audit.
- **Cetak struk**: lihat `docs/CETAK-STRUK.md`. Tidak butuh migrasi.
