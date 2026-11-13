# Jam berlaku aturan "Wajib dekat outlet"

- Jalankan `21_migration.sql` di Supabase > SQL Editor (sekali; aman diulang). Tanpa migrasi ini, bagian "Jam berlaku" di halaman Aturan & Sistem tidak tampil dan aturan tetap sepanjang hari seperti sebelumnya.
- MDM memilih **Sepanjang hari** atau **Atur jam** (dari jam, sampai jam) di Aturan & Sistem. Di luar jam itu, check-in dan input penjualan tidak dicek jaraknya.
- Jam dibaca menurut zona waktu cabang frontliner (WIB/WITA/WIT). Rentang boleh melewati tengah malam (mis. 20:00-04:00).
- Saklar utama tetap berlaku: bila "Wajib dekat outlet" nonaktif, jam diabaikan.
- Pengecekan memakai waktu saat data diterima server. Penjualan yang diantrekan saat offline dicek pada waktu sinkron, bukan waktu diketik.
