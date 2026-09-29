-- Migrasi 05: hak edit outlet untuk frontliner (hanya outlet miliknya) dan akses kunjungan untuk TL/Kormot. Jalankan sekali.
drop policy outlets_write on outlets;
create policy outlets_write on outlets for all
  using (my_role() = 'mdm'
      or (my_role() in ('mds','rmdm','tl','kormot') and cabang_id in (select my_cabang_ids()))
      or (my_role() = 'frontliner' and kode_md = (select user_id from profiles where id = auth.uid())))
  with check (my_role() = 'mdm'
      or (my_role() in ('mds','rmdm','tl','kormot') and cabang_id in (select my_cabang_ids()))
      or (my_role() = 'frontliner' and kode_md = (select user_id from profiles where id = auth.uid())));

drop policy visits_read on visits;
create policy visits_read on visits for select using (
  frontliner_id = auth.uid() or my_role() = 'mdm'
  or (my_role() in ('mds','rmdm') and cabang_id in (select my_cabang_ids()))
  or frontliner_id in (select id from profiles where atasan_id = auth.uid()));   -- TL/Kormot: bawahannya
