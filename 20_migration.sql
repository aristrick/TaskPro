-- 20_migration.sql: pembatalan check-in (untuk tombol "Batalkan" setelah check-in satu ketukan di HP).
-- Jalankan sekali di Supabase > SQL Editor. Aman dijalankan ulang.
--
-- Aturan (dijaga di database, bukan hanya di aplikasi):
--   * hanya frontliner pemilik kunjungan;
--   * kunjungan masih berjalan (belum check-out);
--   * belum ada penjualan;
--   * baru dibuat, maksimal 3 menit yang lalu.
-- Kunjungan yang dibatalkan dihapus, sehingga outlet tidak tercatat dikunjungi dan frontliner bisa check-in lagi.

create or replace function batal_checkin(p_visit uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v visits;
begin
  select * into v from visits where id = p_visit;
  if not found or v.frontliner_id is distinct from auth.uid() then raise exception 'Kunjungan tidak ditemukan.'; end if;
  if v.checkout_at is not null then raise exception 'Kunjungan ini sudah check-out.'; end if;
  if exists (select 1 from sales where visit_id = v.id) then raise exception 'Kunjungan ini sudah punya penjualan, jadi tidak bisa dibatalkan.'; end if;
  if v.checkin_at < now() - interval '3 minutes' then raise exception 'Check-in hanya bisa dibatalkan dalam 3 menit pertama.'; end if;
  delete from visits where id = v.id;
end $$;

revoke all on function batal_checkin(uuid) from public;
grant execute on function batal_checkin(uuid) to authenticated;
