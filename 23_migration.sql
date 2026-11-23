-- 23_migration.sql: saklar "Cetak struk penjualan frontliner" (khusus MDM).
-- Jalankan sekali di Supabase > SQL Editor. Aman dijalankan ulang. Hanya menambah satu baris di tabel settings.
--
-- Setelah ini MDM bisa mematikan semua fitur cetak di HP frontliner dari menu Aturan & Sistem:
--   * tawaran cetak struk setelah check-out,
--   * menu "Printer dan struk" dan "Cetak ulang struk terakhir" di tab Profile.
-- Penjualan dan check-out tidak terpengaruh. Bawaan: aktif (perilaku lama).
-- Yang boleh mengubah hanya MDM (kebijakan settings_write yang sudah ada); setiap perubahan tercatat di Jejak Audit (trigger audit_settings).
-- Aplikasi tetap berjalan tanpa migrasi ini (dianggap aktif), tetapi saklar tidak bisa disimpan sebelum baris ini ada.

insert into settings values ('cetak_aktif', 'true'::jsonb)
  on conflict (key) do nothing;
