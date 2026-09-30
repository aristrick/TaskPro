-- Migrasi 10: Project. Nama project mengisi kolom "Project" di Excel (Kunjungan dan Selling). Jalankan sekali.
create table projects (
  id uuid primary key default gen_random_uuid(),
  cabang_id uuid not null references cabang(id),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (cabang_id, name));
alter table profiles add column project_id uuid references projects(id) on delete set null;   -- satu frontliner, satu project
alter table visits   add column project_id uuid references projects(id) on delete restrict;    -- project saat check-in: riwayat tidak berubah
alter table projects enable row level security;

create policy projects_read on projects for select using (
  (select my_role()) = 'mdm'
  or ((select my_role()) in ('mds', 'rmdm', 'tl', 'kormot') and cabang_id in (select my_cabang_ids())));
create policy projects_write on projects for all
  using      ((select my_role()) = 'mdm' or ((select my_role()) in ('mds', 'rmdm') and cabang_id in (select my_cabang_ids())))
  with check ((select my_role()) = 'mdm' or ((select my_role()) in ('mds', 'rmdm') and cabang_id in (select my_cabang_ids())));

-- Masukkan / keluarkan frontliner dari project (p_project null = keluarkan). Hanya cabang yang menjadi wewenang pemanggil.
create or replace function project_set_member(p_frontliner uuid, p_project uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r user_role; f profiles; pr projects;
begin
  select role into r from profiles where id = auth.uid();
  select * into f from profiles where id = p_frontliner;
  if f.role is distinct from 'frontliner' then raise exception 'Akun bukan frontliner.'; end if;
  if p_project is not null then
    select * into pr from projects where id = p_project;
    if not found then raise exception 'Project tidak ditemukan.'; end if;
    if pr.cabang_id <> f.cabang_id then raise exception 'Frontliner harus dari cabang yang sama dengan project.'; end if;
  end if;
  if r = 'mdm' then null;
  elsif r in ('mds', 'rmdm') and f.cabang_id in (select my_cabang_ids()) then null;
  else raise exception 'Anda tidak berwenang atas cabang ini.'; end if;
  update profiles set project_id = p_project where id = p_frontliner;
end $$;

-- checkin mencatat project frontliner saat itu
create or replace function checkin(p_outlet bigint, p_lat float8, p_lng float8, p_acc float8) returns uuid
language plpgsql security definer set search_path = public as $$
declare me profiles; v uuid;
begin
  select * into me from profiles where id = auth.uid();
  if me.role is distinct from 'frontliner' then raise exception 'Hanya frontliner yang bisa check-in.'; end if;
  perform 1 from outlets where id = p_outlet and kode_md = me.user_id;
  if not found then raise exception 'Outlet ini bukan milik Anda.'; end if;
  perform cek_radius(p_outlet, p_lat, p_lng, p_acc);
  insert into visits (outlet_id, frontliner_id, cabang_id, checkin_lat, checkin_lng, project_id)
    values (p_outlet, me.id, me.cabang_id, p_lat, p_lng, me.project_id) returning id into v;
  return v;
exception when unique_violation then raise exception 'Masih ada kunjungan yang belum check-out.';
end $$;

revoke execute on function project_set_member(uuid, uuid) from public, anon;
grant execute on function project_set_member(uuid, uuid) to authenticated;
