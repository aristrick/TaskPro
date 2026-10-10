-- Migrasi 14: batas minimal waktu antara check-in dan check-out, diatur per frontliner oleh MDS/RMDM/MDM. 0 = tanpa batas. Jalankan sekali.
alter table profiles add column min_checkout_menit int not null default 0 check (min_checkout_menit between 0 and 120);

-- Aturan dijaga di database: check-out ditolak sebelum batas terlewati, apa pun yang ditampilkan aplikasi.
create or replace function checkout(p_visit uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v visits; m int; tunggu double precision;
begin
  select * into v from visits where id = p_visit and frontliner_id = auth.uid() and checkout_at is null;
  if not found then raise exception 'Kunjungan tidak aktif.'; end if;
  select min_checkout_menit into m from profiles where id = auth.uid();
  tunggu := extract(epoch from (v.checkin_at + make_interval(mins => coalesce(m, 0)) - now()));
  if coalesce(m, 0) > 0 and tunggu > 0 then
    raise exception 'Check-out baru bisa dilakukan % menit setelah check-in. Tunggu % detik lagi.', m, ceil(tunggu)::int;
  end if;
  update visits set checkout_at = now(), effective = exists (select 1 from sales where visit_id = p_visit) where id = p_visit;
end $$;
