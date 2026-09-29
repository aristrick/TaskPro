-- Migrasi 03: RMDM hanya melihat cabang yang dia cover. Jalankan sekali di SQL Editor.
alter table cabang add column rmdm_id uuid references profiles(id) on delete set null;

create or replace function my_cabang_ids() returns setof uuid language sql stable security definer set search_path = public
  as $$ select cabang_id from profiles where id = auth.uid() and cabang_id is not null
        union select id from cabang where mds_id = auth.uid() or rmdm_id = auth.uid() $$;

drop policy cabang_read on cabang;  drop policy cabang_write on cabang;
drop policy profiles_read on profiles;
drop policy outlets_read on outlets; drop policy outlets_write on outlets;

create policy cabang_read  on cabang for select using (my_role() = 'mdm' or id in (select my_cabang_ids()));
create policy cabang_write on cabang for all
  using      (my_role() = 'mdm' or (my_role() = 'rmdm' and rmdm_id = auth.uid()))
  with check (my_role() = 'mdm' or (my_role() = 'rmdm' and rmdm_id = auth.uid()));

-- MDM: semua. RMDM/MDS: akun di cabang yang dicover. RMDM juga melihat semua MDS (untuk memegangkan cabang).
create policy profiles_read on profiles for select using (
  my_role() = 'mdm'
  or atasan_id = auth.uid()
  or (my_role() in ('mds','rmdm') and cabang_id in (select my_cabang_ids()))
  or (my_role() = 'rmdm' and role = 'mds'));

create policy outlets_read  on outlets for select using (my_role() = 'mdm' or cabang_id in (select my_cabang_ids()));
create policy outlets_write on outlets for all using (my_role() = 'mdm' or cabang_id in (select my_cabang_ids()))
                                       with check (my_role() = 'mdm' or cabang_id in (select my_cabang_ids()));
