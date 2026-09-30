# TaskPro
## Instalasi baru
1. Supabase → SQL Editor: jalankan `database.sql` (berisi semua migrasi 01–08).
2. Authentication → Users → Add user `mdm01@taskpro.app` (Auto Confirm), lalu jalankan `seed_mdm.sql`.
3. `.env.example` → `.env.local`, isi 3 nilai (Project Settings → API). Jangan di-commit.
4. `npm install` → `npm run dev`. Login `MDM01`.
## Database yang sudah berjalan
Jalankan hanya migrasi yang belum: `06_migration.sql`, `07_migration.sql`, lalu **`08_migration.sql`** (MDS 1 cabang + sesi perangkat/logout paksa; jika ada MDS yang memegang >1 cabang, hanya cabang berkode terkecil yang dipertahankan) (Outlet ID 9 angka acak untuk semua outlet). Opsional `06b_ubah_data_lama.sql`: ubah kode outlet hasil import lama ke format baru.
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
