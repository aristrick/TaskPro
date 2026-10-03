# Backup dan pemulihan (Supabase gratis)

Paket gratis Supabase tidak menyediakan backup otomatis, dan proyek yang tidak aktif selama seminggu dijeda.
Workflow `.github/workflows/backup.yml` menanganinya: tiap hari pukul 01:00 WIB ia menjalankan pembersihan data lama
(yang juga menjaga proyek tetap aktif) lalu membuat backup terenkripsi yang disimpan 14 hari sebagai "artifact" GitHub.

## Menyiapkan (sekali)
1. **Supabase** > tombol **Connect** > pilih **Session pooler** > salin URI-nya, ganti `[YOUR-PASSWORD]` dengan password database.
   (Pakai pooler, bukan "Direct connection": setahunya koneksi langsung memakai IPv6 sedangkan GitHub Actions biasanya IPv4.)
2. **GitHub** > repo > Settings > Secrets and variables > Actions > *New repository secret*:
   - `SUPABASE_DB_URL` = URI dari langkah 1
   - `BACKUP_PASSPHRASE` = kata sandi panjang acak (simpan di pengelola kata sandi, **terpisah** dari repo; tanpa ini backup tidak bisa dibuka)
3. Tab **Actions** > *Backup dan pemeliharaan database* > **Run workflow**. Pastikan hijau, lalu unduh artifact `backup-db`.
4. Jika versi Postgres proyek Anda berbeda dari 17, ubah `PGIMG` di workflow (pg_dump harus sama atau lebih baru dari server).

> Workflow ini belum pernah dijalankan terhadap proyek Anda. Jalankan sekali secara manual dan **uji pemulihan** (di bawah) sebelum mengandalkannya.

## Membuka backup
```bash
gpg -d backup-2026-10-04.tar.gpg > backup.tar     # diminta BACKUP_PASSPHRASE
tar xf backup.tar                                  # menghasilkan public.dump dan auth.dump
```

## Memulihkan ke proyek Supabase yang baru/kosong
Gunakan URI **Session pooler** proyek tujuan (`$URL`). Urutan penting: akun dulu, baru data aplikasi (profil merujuk ke akun).
```bash
pg_restore --data-only --no-owner -d "$URL" auth.dump
pg_restore --clean --if-exists --no-owner -d "$URL" public.dump
```
Lalu isi lagi variabel lingkungan di Vercel dengan URL dan kunci proyek baru. Coba sekali di proyek percobaan agar Anda tahu langkahnya sebelum darurat.

## Keamanan
Backup berisi hash password dan data lokasi karyawan. Karena itu dienkripsi AES-256. Jaga repo tetap **Private** dan batasi siapa yang boleh membaca secrets/artifact.
