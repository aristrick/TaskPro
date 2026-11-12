# Perubahan UI/UX v20

Penerapan dokumen "Saran UI/UX TaskPro: Admin Web dan HP Frontliner".

## Wajib dijalankan
- `20_migration.sql` di Supabase > SQL Editor (fungsi `batal_checkin` untuk tombol "Batalkan" setelah check-in satu ketukan). Tanpa ini aplikasi tetap jalan, hanya Batalkan yang gagal.

## Admin web
Sidebar terang berkelompok; konten dipusatkan (maks 1280 px); halaman baru `/pengaturan`; menu "⋯" dan chip status di tabel; panel samping untuk form tambah/ubah (Frontliner, Outlet, Produk, Cabang); pencarian Outlet selebar baris + chip filter; pintasan tanggal (Report, Stok, Edit Penjualan); Stok: daftar belum mengisi dilipat; tip bantuan yang bisa ditutup; Project dua kolom; angka berpemisah ribuan + hitung naik.

## HP frontliner
Header satu baris + judul besar + lencana progres; check-in satu ketukan (radius 50 m) dengan Batalkan; tombol Masuk/Rute; pemilih rayon bottom sheet; tombol tambah melayang; tarik-untuk-segarkan; alamat ringkas; navigasi bawah terang; sheet Stok/Printer dengan pegangan geser dan jarak bawah; Profile (inisial, kartu Hari ini); Rekap (kepala bulan, hari kosong diredupkan, grafik mini 7 hari).

## Belum dikerjakan
Mode gelap, pencarian cepat Ctrl+K, navigasi bawah admin di HP, transisi list-ke-detail yang menyambung, indikator antrean offline baru. Periksa celah piksel di tepi layar pada HP sungguhan.

## Sebelum deploy
`npm install && npm run typecheck && npm run lint && npm test && npm run build` (kode ini belum dibuild di lingkungan penyusunnya).
