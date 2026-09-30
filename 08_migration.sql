-- Migrasi 08: (1) MDS hanya boleh memegang 1 cabang, RMDM tetap boleh banyak cabang.
--             (2) Sesi perangkat: penanda akun aktif, login 1 perangkat untuk frontliner, logout paksa. Jalankan sekali.

-- (1) Jika ada MDS yang sudah memegang lebih dari 1 cabang, hanya cabang dengan kode terkecil yang dipertahankan;
--     cabang lainnya dikosongkan dan bisa diberikan ke MDS lain lewat menu MDS & RMDM.
update cabang c set mds_id = null
 where mds_id is not null
   and id <> (select c2.id from cabang c2 where c2.mds_id = c.mds_id order by c2.kode limit 1);
create unique index if not exists cabang_mds_uq on cabang (mds_id) where mds_id is not null;

-- (2) Satu baris per perangkat yang sedang login. last_seen diperbarui tiap ~45 detik saat aplikasi terbuka.
create table if not exists device_sessions (
  user_id uuid not null references profiles(id) on delete cascade,
  device_id text not null,
  ua text,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, device_id));
alter table device_sessions enable row level security;
-- Membaca: sesi milik sendiri dan akun yang boleh dilihat (mengikuti aturan tabel profiles). Menulis hanya lewat fungsi.
drop policy if exists sesi_read on device_sessions;
create policy sesi_read on device_sessions for select using (user_id in (select id from profiles));

-- Daftarkan perangkat. Frontliner ditolak jika ada perangkat lain yang aktif dalam 10 menit terakhir
-- (ubah 'interval 10 minutes' di sini DAN AKTIF_MENIT di lib/sesi.ts bila ingin mengganti).
create or replace function sesi_klaim(p_device text, p_ua text default null) returns void
language plpgsql security definer set search_path = public as $$
declare me profiles;
begin
  select * into me from profiles where id = auth.uid();
  if not found then raise exception 'Akun tidak ditemukan'; end if;
  if me.role = 'frontliner' then
    if exists (select 1 from device_sessions where user_id = me.id and device_id <> p_device and last_seen > now() - interval '10 minutes') then
      raise exception 'AKUN_AKTIF';
    end if;
    delete from device_sessions where user_id = me.id and device_id <> p_device;
  end if;
  insert into device_sessions (user_id, device_id, ua) values (me.id, p_device, p_ua)
    on conflict (user_id, device_id) do update set last_seen = now(), ua = excluded.ua;
end $$;

-- Denyut: true = sesi masih sah; false = sudah diakhiri (login di perangkat lain / logout paksa).
create or replace function sesi_detak(p_device text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update device_sessions set last_seen = now() where user_id = auth.uid() and device_id = p_device;
  return found;
end $$;

create or replace function sesi_lepas(p_device text) returns void
language plpgsql security definer set search_path = public as $$
begin delete from device_sessions where user_id = auth.uid() and device_id = p_device; end $$;

-- Logout paksa. Hanya dipanggil server (service role) setelah cek wewenang.
create or replace function sesi_paksa(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from device_sessions where user_id = p_user;
  begin delete from auth.sessions where user_id = p_user;   -- mencabut refresh token; abaikan jika tidak diizinkan
  exception when others then null; end;
end $$;
revoke execute on function sesi_paksa(uuid) from public, anon, authenticated;
