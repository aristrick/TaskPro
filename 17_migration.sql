-- 17_migration.sql — Hapus penjualan (khusus MDM)
-- Hanya MENAMBAH satu fungsi baru. Tidak mengubah tabel, fungsi, kebijakan, atau data yang sudah ada. Boleh dijalankan berulang kali.
--
-- penjualan_hapus menghapus SEMUA baris penjualan pada satu kunjungan. Kunjungannya sendiri tetap ada (jam check-in dan check-out utuh)
-- dan menjadi kunjungan tanpa penjualan (bukan Effective Call). Aturannya:
--   * hanya MDM, dan alasan wajib diisi (minimal 3 huruf),
--   * kunjungan harus sudah check-out dan memang punya penjualan,
--   * nilai lama (produk, jumlah, harga, total) dan alasan dicatat di audit_log dengan aksi HAPUS_PENJUALAN.
-- Stok pembawaan dihitung dari penjualan, jadi stok yang tadinya terpakai otomatis kembali.

create or replace function penjualan_hapus(p_visit uuid, p_alasan text) returns void
language plpgsql security definer set search_path = public as $$
declare v visits; au text; fl text; ol text; lama jsonb;
begin
  if (select role from profiles where id = auth.uid()) is distinct from 'mdm' then raise exception 'Hanya MDM.'; end if;
  if p_alasan is null or length(trim(p_alasan)) < 3 then raise exception 'Alasan penghapusan wajib diisi.'; end if;
  select * into v from visits where id = p_visit;
  if not found then raise exception 'Kunjungan tidak ditemukan.'; end if;
  if v.checkout_at is null then raise exception 'Kunjungan masih berjalan. Penjualan baru tersimpan saat check-out.'; end if;
  if not exists (select 1 from sales where visit_id = v.id) then raise exception 'Kunjungan ini tidak punya penjualan.'; end if;
  select user_id into au from profiles where id = auth.uid();
  select user_id into fl from profiles where id = v.frontliner_id;
  select name into ol from outlets where id = v.outlet_id;
  lama := jsonb_build_object(
    'total', (select coalesce(sum(s.qty * s.price), 0) from sales s where s.visit_id = v.id),
    'penjualan', (select coalesce(jsonb_agg(jsonb_build_object('produk', pr.product, 'qty', s.qty, 'harga', s.price) order by pr.product), '[]'::jsonb)
                    from sales s join products pr on pr.id = s.product_id where s.visit_id = v.id));
  delete from sales where visit_id = v.id;
  update visits set effective = false where id = v.id;
  insert into audit_log (actor, actor_user_id, action, tabel, row_id, detail) values (auth.uid(), au, 'HAPUS_PENJUALAN', 'visits', v.id::text,
    jsonb_build_object('frontliner', fl, 'outlet', ol, 'checkin', v.checkin_at, 'alasan', trim(p_alasan), 'lama', lama));
end $$;

revoke execute on function penjualan_hapus(uuid, text) from public, anon;
grant execute on function penjualan_hapus(uuid, text) to authenticated;
