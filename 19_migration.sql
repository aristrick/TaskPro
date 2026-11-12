-- 19_migration.sql — Schedule Taskforce: jadwal rayon per frontliner (Senin–Sabtu, Minggu ke 1–4) dan kunci jadwal
-- Hanya MENAMBAH: 2 kolom baru, 1 tabel baru, beberapa fungsi baru, dan 2 pemicu (visits dan outlets).
-- Tidak mengubah fungsi, kebijakan, atau data yang sudah ada. Boleh dijalankan berulang kali.
-- (Pemicu pada visits dan outlets hanya bertindak untuk frontliner yang jadwalnya dikunci; selain itu tidak berpengaruh.)
--
-- Konsep
--   * 24 rayon = 4 minggu x 6 hari (Senin–Sabtu). Tiap hari pada tiap minggu diisi rayon yang dikunjungi frontliner pada hari itu.
--   * Siklus berputar terus: Minggu ke 1 → 2 → 3 → 4 → 1 dst. Awal siklus (Senin Minggu ke 1) diatur per cabang di cabang.schedule_start.
--     Selama belum diatur dipakai Senin 1 Jan 2024 sebagai patokan, jadi hari ini selalu punya posisi minggu yang pasti.
--   * Satu hari boleh berisi lebih dari satu rayon. Hari Minggu tidak punya jadwal.
--   * Kunci jadwal (profiles.schedule_locked): hanya MDM dan RMDM yang bisa mengubah. Jika menyala, frontliner tidak bisa memilih rayon dan
--     check-in hanya diterima untuk outlet pada rayon jadwal hari itu. Aturan ini dijaga di database (pemicu pada visits), bukan hanya di layar.
--   * MDS, RMDM, dan MDM mengatur isi jadwal frontliner di cabang yang menjadi wewenangnya.

alter table cabang   add column if not exists schedule_start  date;
alter table profiles add column if not exists schedule_locked boolean not null default false;

create table if not exists schedule_taskforce (
  id            uuid primary key default gen_random_uuid(),
  frontliner_id uuid not null references profiles(id) on delete cascade,
  minggu        smallint not null check (minggu between 1 and 4),
  hari          smallint not null check (hari between 1 and 6),          -- 1 = Senin ... 6 = Sabtu
  rayon         smallint not null check (rayon between 1 and 24),
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (frontliner_id, minggu, hari, rayon));
create index if not exists schedule_taskforce_fl_idx on schedule_taskforce (frontliner_id);

alter table schedule_taskforce enable row level security;
-- Baca: siapa pun yang boleh melihat profil frontliner itu (admin cabangnya, TL/Kormot atasannya, dan frontliner sendiri).
-- Tidak ada kebijakan tulis: perubahan hanya lewat fungsi di bawah, yang memeriksa wewenang.
drop policy if exists schedule_read on schedule_taskforce;
create policy schedule_read on schedule_taskforce for select using (frontliner_id in (select id from profiles));

-- Posisi sebuah tanggal dalam siklus 4 minggu cabang: minggu 1–4 dan hari 1–7 (7 = Minggu). Tanpa tanggal = hari ini menurut zona waktu cabang.
create or replace function schedule_posisi(p_cabang uuid, p_tgl date default null) returns table (minggu int, hari int)
language sql stable security definer set search_path = public as $$
  with t as (select coalesce(p_tgl, (now() at time zone cabang_tz(p_cabang))::date) as d,
                    coalesce((select schedule_start from cabang where id = p_cabang), date '2024-01-01') as s)
  select (((floor((d - s)::numeric / 7)::int % 4) + 4) % 4) + 1, extract(isodow from d)::int from t $$;

-- Pemeriksa wewenang. p_kunci = true untuk aksi mengunci (hanya MDM dan RMDM). Mengembalikan profil frontliner-nya.
create or replace function schedule_cek(p_frontliner uuid, p_kunci boolean default false) returns profiles
language plpgsql security definer set search_path = public as $$
declare r user_role; f profiles;
begin
  select role into r from profiles where id = auth.uid();
  select * into f from profiles where id = p_frontliner;
  if not found or f.role is distinct from 'frontliner' then raise exception 'Akun bukan frontliner.'; end if;
  if r = 'mdm' then null;
  elsif r = 'rmdm' and f.cabang_id in (select my_cabang_ids()) then null;
  elsif r = 'mds' and p_kunci then raise exception 'Hanya MDM dan RMDM yang dapat mengunci jadwal.';
  elsif r = 'mds' and f.cabang_id in (select my_cabang_ids()) then null;
  else raise exception 'Anda tidak berwenang atas frontliner ini.'; end if;
  return f;
end $$;

-- Tambah satu rayon pada satu hari. Rayon yang sama pada hari yang sama tidak digandakan (diabaikan).
create or replace function schedule_tambah(p_frontliner uuid, p_minggu int, p_hari int, p_rayon int) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  perform schedule_cek(p_frontliner);
  if p_minggu not between 1 and 4 then raise exception 'Minggu harus 1 sampai 4.'; end if;
  if p_hari not between 1 and 6 then raise exception 'Hari harus Senin sampai Sabtu.'; end if;
  if p_rayon not between 1 and 24 then raise exception 'Rayon harus 1 sampai 24.'; end if;
  insert into schedule_taskforce (frontliner_id, minggu, hari, rayon, created_by) values (p_frontliner, p_minggu, p_hari, p_rayon, auth.uid())
    on conflict (frontliner_id, minggu, hari, rayon) do nothing returning id into v;
  if v is null then select id into v from schedule_taskforce where frontliner_id = p_frontliner and minggu = p_minggu and hari = p_hari and rayon = p_rayon; end if;
  return v;
end $$;

-- Lepas satu rayon dari satu hari. Saat jadwal terkunci, rayon terakhir tidak boleh dilepas (frontliner akan tidak punya jadwal sama sekali).
create or replace function schedule_lepas(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s schedule_taskforce; f profiles;
begin
  select * into s from schedule_taskforce where id = p_id;
  if not found then return; end if;
  f := schedule_cek(s.frontliner_id);
  if f.schedule_locked and (select count(*) from schedule_taskforce where frontliner_id = s.frontliner_id) <= 1 then
    raise exception 'Jadwal sedang dikunci dan ini rayon terakhirnya. Matikan kunci dulu sebelum mengosongkan jadwal.';
  end if;
  delete from schedule_taskforce where id = p_id;
end $$;

-- Isi urut: hari yang masih kosong diisi rayon sesuai urutan (Minggu 1 Senin = R01 ... Minggu 4 Sabtu = R24).
-- Rayon yang sudah dipakai di hari lain pada jadwal frontliner itu dilewati. Mengembalikan jumlah hari yang terisi.
create or replace function schedule_isi_urut(p_frontliner uuid) returns int
language plpgsql security definer set search_path = public as $$
declare m int; h int; r int; n int := 0;
begin
  perform schedule_cek(p_frontliner);
  for m in 1..4 loop for h in 1..6 loop
    r := (m - 1) * 6 + h;
    if not exists (select 1 from schedule_taskforce where frontliner_id = p_frontliner and minggu = m and hari = h)
       and not exists (select 1 from schedule_taskforce where frontliner_id = p_frontliner and rayon = r) then
      insert into schedule_taskforce (frontliner_id, minggu, hari, rayon, created_by) values (p_frontliner, m, h, r, auth.uid());
      n := n + 1;
    end if;
  end loop; end loop;
  return n;
end $$;

-- Kunci jadwal (khusus MDM dan RMDM). Mengunci hanya boleh jika jadwal frontliner itu sudah terisi, agar frontliner tidak terkunci tanpa jadwal.
create or replace function schedule_kunci(p_frontliner uuid, p_kunci boolean) returns void
language plpgsql security definer set search_path = public as $$
declare f profiles; au text;
begin
  f := schedule_cek(p_frontliner, true);
  if p_kunci and not exists (select 1 from schedule_taskforce where frontliner_id = p_frontliner) then
    raise exception 'Isi jadwal frontliner ini dulu sebelum mengunci.';
  end if;
  if f.schedule_locked is not distinct from p_kunci then return; end if;
  update profiles set schedule_locked = p_kunci where id = p_frontliner;
  select user_id into au from profiles where id = auth.uid();
  insert into audit_log (actor, actor_user_id, action, tabel, row_id, detail) values (auth.uid(), au,
    case when p_kunci then 'KUNCI_JADWAL' else 'BUKA_KUNCI_JADWAL' end, 'profiles', p_frontliner::text,
    jsonb_build_object('frontliner', f.user_id, 'nama', f.nama));
end $$;

-- Awal siklus per cabang: Senin yang menjadi Minggu ke 1 (kosong = kembali ke patokan bawaan). Khusus MDM dan RMDM.
create or replace function schedule_set_start(p_cabang uuid, p_tgl date) returns void
language plpgsql security definer set search_path = public as $$
declare r user_role; au text;
begin
  select role into r from profiles where id = auth.uid();
  if r = 'mdm' then null;
  elsif r = 'rmdm' and p_cabang in (select my_cabang_ids()) then null;
  else raise exception 'Hanya MDM dan RMDM yang dapat mengatur awal siklus.'; end if;
  if p_tgl is not null and extract(isodow from p_tgl) <> 1 then raise exception 'Awal siklus harus hari Senin.'; end if;
  update cabang set schedule_start = p_tgl where id = p_cabang;
  if not found then raise exception 'Cabang tidak ditemukan.'; end if;
  select user_id into au from profiles where id = auth.uid();
  insert into audit_log (actor, actor_user_id, action, tabel, row_id, detail) values (auth.uid(), au, 'ATUR_SIKLUS_JADWAL', 'cabang', p_cabang::text,
    jsonb_build_object('awal_siklus', p_tgl));
end $$;

-- Jadwal hari ini untuk frontliner yang sedang login: {locked, minggu, hari, rayon:[...]}.
create or replace function jadwal_hari_ini() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare f profiles; m int; h int;
begin
  select * into f from profiles where id = auth.uid();
  if f.role is distinct from 'frontliner' then return jsonb_build_object('locked', false, 'minggu', null, 'hari', null, 'rayon', '[]'::jsonb); end if;
  select p.minggu, p.hari into m, h from schedule_posisi(f.cabang_id) p;
  return jsonb_build_object('locked', f.schedule_locked, 'minggu', m, 'hari', h, 'rayon',
    coalesce((select jsonb_agg(rayon order by rayon) from schedule_taskforce where frontliner_id = f.id and minggu = m and hari = h), '[]'::jsonb));
end $$;

-- Penjaga di database: frontliner yang jadwalnya terkunci hanya bisa check-in di outlet pada rayon jadwal hari ini.
create or replace function visits_cek_jadwal() returns trigger
language plpgsql security definer set search_path = public as $$
declare f profiles; o outlets; m int; h int; ada text;
begin
  select * into f from profiles where id = new.frontliner_id;
  if not coalesce(f.schedule_locked, false) then return new; end if;
  select * into o from outlets where id = new.outlet_id;
  select p.minggu, p.hari into m, h from schedule_posisi(f.cabang_id) p;
  select string_agg('R' || lpad(rayon::text, 2, '0'), ', ' order by rayon) into ada from schedule_taskforce where frontliner_id = f.id and minggu = m and hari = h;
  if ada is null then raise exception 'Jadwal dikunci dan hari ini tidak ada jadwal kunjungan untuk Anda.'; end if;
  if not exists (select 1 from schedule_taskforce where frontliner_id = f.id and minggu = m and hari = h and rayon = o.rayon) then
    raise exception 'Jadwal dikunci. Hari ini jadwal Anda rayon %, outlet ini rayon %.', ada, coalesce('R' || lpad(o.rayon::text, 2, '0'), '(kosong)');
  end if;
  return new;
end $$;
drop trigger if exists trg_visits_jadwal on visits;
create trigger trg_visits_jadwal before insert on visits for each row execute function visits_cek_jadwal();

-- Penutup celah: frontliner yang jadwalnya terkunci tidak boleh memindahkan outlet ke rayon lain, sebab check-in dinilai dari rayon outlet.
-- Admin (MDM/RMDM/MDS) dan proses server tetap bebas mengubah rayon.
create or replace function outlets_cek_kunci_rayon() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.rayon is distinct from old.rayon and exists (select 1 from profiles where id = auth.uid() and role = 'frontliner' and schedule_locked) then
    raise exception 'Jadwal dikunci. Rayon outlet hanya bisa diubah oleh admin.';
  end if;
  return new;
end $$;
drop trigger if exists trg_outlets_kunci_rayon on outlets;
create trigger trg_outlets_kunci_rayon before update of rayon on outlets for each row execute function outlets_cek_kunci_rayon();

revoke execute on function schedule_posisi(uuid, date), schedule_cek(uuid, boolean), schedule_tambah(uuid, int, int, int), schedule_lepas(uuid),
  schedule_isi_urut(uuid), schedule_kunci(uuid, boolean), schedule_set_start(uuid, date), jadwal_hari_ini(), visits_cek_jadwal(), outlets_cek_kunci_rayon() from public, anon;
revoke execute on function schedule_cek(uuid, boolean), visits_cek_jadwal(), outlets_cek_kunci_rayon() from authenticated;   -- fungsi internal: hanya dipanggil fungsi lain / pemicu
grant execute on function schedule_posisi(uuid, date), schedule_tambah(uuid, int, int, int), schedule_lepas(uuid), schedule_isi_urut(uuid),
  schedule_kunci(uuid, boolean), schedule_set_start(uuid, date), jadwal_hari_ini() to authenticated;
