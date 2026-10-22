# Mode sinyal lemah (layar frontliner)

## Yang bisa dilakukan tanpa sinyal

| Situasi | Perilaku |
|---|---|
| Aplikasi sudah pernah dibuka online, lalu dibuka lagi tanpa sinyal | Halaman terbuka dari cache (service worker). Jika sedang ada kunjungan berjalan, kunjungan terakhir yang tersimpan ditampilkan dengan pita "Mode offline" |
| Sinyal hilang saat menekan Check-out | Penjualan dan **jam saat tombol ditekan** disimpan di HP. Frontliner melihat "Tersimpan di HP" dan struk tetap ditawarkan |
| Sinyal kembali | Terkirim otomatis (saat online, tiap 30 detik, dan saat aplikasi kembali ke layar). Ada tombol "Kirim sekarang" |

## Yang tetap butuh internet

- **Check-in.** Sengaja tidak diantrekan: server perlu memeriksa radius 50 m dan mencatat waktu dengan jam server. Jika masih ada check-out yang mengantre, check-in baru menunggu sampai antrean terkirim (server hanya mengizinkan satu kunjungan berjalan).
- Daftar outlet, rekap, dan semua halaman admin.

## Keamanan data

- Pengiriman ulang aman: penjualan sebuah kunjungan ditimpa (bukan ditambah), dan "Kunjungan tidak aktif" dianggap sudah terkirim.
- Jam check-out dikirim lewat `checkout_tertunda` (migrasi 16) dengan pagar: tidak sebelum check-in, tidak di masa depan, tidak lebih tua dari 48 jam, dan batas minimal check-out dihitung dari jam yang dikirim. Jika migrasi 16 belum ada atau jam ditolak, dipakai `checkout()` biasa (jam server).
- Jika server menolak penjualan tertunda (mis. stok tidak cukup), frontliner diberi tahu, kunjungan dibuka kembali dengan isian terakhir, lalu bisa diperbaiki dan di-check-out ulang. Tidak ada data yang hilang diam-diam.
- Salinan di HP: antrean (`taskpro-outbox`), salinan kunjungan berjalan (`taskpro-snap-<id>`, kedaluwarsa 24 jam), dan draf (`taskpro-draft-<id>`, dibuang setelah 3 hari). Semuanya milik akun di perangkat itu dan dihapus saat terkirim.

## Batasan yang perlu diketahui

- Memakai jam HP untuk mencatat waktu check-out saat offline. Jam yang melenceng lebih dari 2 menit ke depan ditolak server (lalu dipakai jam server).
- Halaman hanya bisa dibuka offline setelah pernah dimuat sekali dengan sinyal. Setelah rilis baru, muat sekali lagi dengan sinyal.
- Salinan kunjungan hanya ada jika kunjungan berjalan sebelum sinyal hilang. Tanpa kunjungan berjalan dan tanpa sinyal, aplikasi menampilkan pesan gagal memuat.

## Pengujian

`tests/e2e/sinyal-lemah.spec.ts` meniru semua skenario di atas (jaringan putus, kembali, server menolak, aplikasi dibuka ulang offline, dan service worker). Logika antreannya dites di `tests/unit/outbox.test.ts`, dan fungsi database di `tests/sql/80_v16_test.sql`.
