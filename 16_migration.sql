-- 16_migration.sql — Check-out tertunda (mode sinyal lemah di layar frontliner)
-- Hanya MENAMBAH satu fungsi baru. Tidak mengubah tabel, fungsi, kebijakan, atau data yang sudah ada,
-- jadi aman dijalankan saat aplikasi sedang dipakai. Boleh dijalankan berulang kali.
--
-- Latar belakang: check-out yang gagal karena sinyal hilang disimpan di perangkat lalu dikirim ulang saat online.
-- Fungsi checkout() lama mencatat waktu server saat dikirim, sehingga jam check-out jadi salah. Fungsi ini menerima
-- waktu asli saat frontliner menekan check-out, dengan pagar berikut:
--   * hanya kunjungan milik pemanggil yang masih berjalan,
--   * waktu tidak boleh sebelum check-in, dan tidak boleh di masa depan (toleransi jam HP 2 menit),
--   * waktu tidak boleh lebih tua dari 48 jam (setelah itu aplikasi memakai checkout() biasa),
--   * batas minimal check-out (min_checkout_menit) dihitung dari waktu yang dikirim, bukan waktu server.
-- save_sales() sudah aman dikirim ulang (menghapus lalu mengisi ulang penjualan kunjungan itu), jadi tidak diubah.

create or replace function checkout_tertunda(p_visit uuid, p_at timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare v visits; m int;
begin
  select * into v from visits where id = p_visit and frontliner_id = auth.uid() and checkout_at is null;
  if not found then raise exception 'Kunjungan tidak aktif.'; end if;
  if p_at is null or p_at < v.checkin_at or p_at > now() + interval '2 minutes' then raise exception 'Waktu check-out tidak valid.'; end if;
  if p_at < now() - interval '48 hours' then raise exception 'Data tertunda lebih dari 48 jam.'; end if;
  select min_checkout_menit into m from profiles where id = auth.uid();
  if coalesce(m, 0) > 0 and p_at < v.checkin_at + make_interval(mins => m) then
    raise exception 'Check-out baru bisa dilakukan % menit setelah check-in.', m;
  end if;
  update visits set checkout_at = least(p_at, now()), effective = exists (select 1 from sales where visit_id = p_visit) where id = p_visit;
end $$;

revoke execute on function checkout_tertunda(uuid, timestamptz) from public, anon;
grant execute on function checkout_tertunda(uuid, timestamptz) to authenticated;
