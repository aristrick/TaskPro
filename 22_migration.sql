-- 22_migration.sql: Tracking Go (Back Tracking, OTJ, Riwayat) di dalam TaskPro.
-- Jalankan sekali di Supabase > SQL Editor. Aman dijalankan ulang. Hanya menambah objek baru, tidak mengubah data yang ada.
--
-- Tidak ada upload data: kunjungan, penjualan, dan outlet memakai tabel TaskPro (visits, sales, outlets).
-- Yang disimpan di sini hanya hasil kerja Tracking Go:
--   * backtrack_konfirmasi : hasil konfirmasi satu kunjungan (toko ada?, penjualan sesuai?, 4 indikator, temuan, jarak GPS);
--   * otj_penilaian        : hasil On-the-Job Assessment satu hari (Pra, Selama per toko, Pasca, skor).
--
-- Aturan (dijaga di database, bukan hanya di aplikasi):
--   * yang boleh mengisi: MDM, RMDM, MDS, TL, Kormot. Frontliner tidak bisa menulis atau membaca tabel ini;
--   * MDM semua cabang; RMDM dan MDS hanya cabang wewenangnya; TL dan Kormot hanya frontliner bawahannya
--     (sama seperti aturan baca kunjungan di TaskPro);
--   * konfirmasi Back Tracking wajib dilakukan di dekat outlet (maksimal 50 m). Jarak dihitung DI DATABASE dari koordinat outlet
--     dan titik GPS yang dikirim, bukan angka kiriman aplikasi;
--   * satu kunjungan hanya bisa dikonfirmasi satu kali; hasilnya tidak bisa diubah (hanya dihapus MDM atau RMDM, tercatat di Jejak Audit);
--   * pengisi dicatat dari akun yang login, bukan dari kiriman aplikasi.

-- ============ Back Tracking ============
create table if not exists backtrack_konfirmasi (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid unique references visits(id) on delete set null,   -- kunjungan dihapus: hasil konfirmasi tetap ada sebagai arsip
  cabang_id uuid not null references cabang(id),
  frontliner_id uuid references profiles(id) on delete set null,
  frontliner_user_id text, frontliner_nama text,                    -- salinan agar riwayat tetap terbaca walau akun dihapus
  outlet_id bigint, outlet_kode text, outlet_nama text,
  visit_date date not null,                                          -- tanggal check-in menurut zona waktu cabang
  checkin_at timestamptz,
  toko_ada boolean not null,
  penjualan_sesuai boolean not null,
  jam_kunjungan jsonb not null, on_rayon jsonb not null, kunjungan_manual jsonb not null, pv_satu jsonb not null,   -- {status: Sesuai|TS|N/A, keterangan}
  temuan_lain text not null default '', hasil_diskusi text not null default '',
  device_lat float8, device_lng float8, device_acc float8, jarak_m int,
  oleh_id uuid references profiles(id) on delete set null,
  oleh_user_id text, oleh_nama text, oleh_role text,
  created_at timestamptz not null default now()
);
create index if not exists bt_cabang_waktu_idx on backtrack_konfirmasi (cabang_id, created_at desc);
create index if not exists bt_fl_tgl_idx on backtrack_konfirmasi (frontliner_id, visit_date);

-- ============ OTJ ============
create table if not exists otj_penilaian (
  id uuid primary key default gen_random_uuid(),
  tipe text not null check (tipe in ('Taskforce', 'MD GT')),
  divisi text not null default '',
  cabang_id uuid not null references cabang(id),
  frontliner_id uuid references profiles(id) on delete set null,
  frontliner_user_id text, frontliner_nama text not null,
  tanggal date not null,
  jawaban_pra jsonb not null default '{}', jawaban_pasca jsonb not null default '{}',   -- {id item: Ya|Tidak|N/A}
  kunjungan jsonb not null default '[]',                                                  -- [{outlet_id, outlet_nama, jawaban}]
  akar_masalah jsonb not null default '{}', action_plan jsonb not null default '{}',     -- {pra, kunjungan, pasca}
  skor int check (skor between 0 and 100),
  oleh_id uuid references profiles(id) on delete set null,
  oleh_user_id text, oleh_nama text not null, oleh_role text,
  created_at timestamptz not null default now()
);
create index if not exists otj_cabang_waktu_idx on otj_penilaian (cabang_id, created_at desc);
create index if not exists otj_fl_tgl_idx on otj_penilaian (frontliner_id, tanggal);

alter table backtrack_konfirmasi enable row level security;
alter table otj_penilaian enable row level security;

-- Baca: MDM semua; MDS/RMDM cabang wewenangnya; TL/Kormot bawahannya; pengisi selalu bisa membaca isiannya sendiri.
drop policy if exists bt_read on backtrack_konfirmasi;
create policy bt_read on backtrack_konfirmasi for select using (
  (select my_role()) = 'mdm'
  or ((select my_role()) in ('mds', 'rmdm') and cabang_id in (select my_cabang_ids()))
  or ((select my_role()) in ('tl', 'kormot') and frontliner_id in (select id from profiles where atasan_id = (select auth.uid())))
  or oleh_id = (select auth.uid()));
drop policy if exists otj_read on otj_penilaian;
create policy otj_read on otj_penilaian for select using (
  (select my_role()) = 'mdm'
  or ((select my_role()) in ('mds', 'rmdm') and cabang_id in (select my_cabang_ids()))
  or ((select my_role()) in ('tl', 'kormot') and frontliner_id in (select id from profiles where atasan_id = (select auth.uid())))
  or oleh_id = (select auth.uid()));

-- Hapus: hanya MDM, atau RMDM untuk cabang yang dia cover. Tidak ada kebijakan tulis/ubah: menulis hanya lewat fungsi di bawah.
drop policy if exists bt_delete on backtrack_konfirmasi;
create policy bt_delete on backtrack_konfirmasi for delete using (
  (select my_role()) = 'mdm' or ((select my_role()) = 'rmdm' and cabang_id in (select my_cabang_ids())));
drop policy if exists otj_delete on otj_penilaian;
create policy otj_delete on otj_penilaian for delete using (
  (select my_role()) = 'mdm' or ((select my_role()) = 'rmdm' and cabang_id in (select my_cabang_ids())));

-- Penghapusan dicatat di Jejak Audit (pola yang sama dengan tabel lain).
drop trigger if exists audit_backtrack on backtrack_konfirmasi;
create trigger audit_backtrack after delete on backtrack_konfirmasi for each row execute function audit_row();
drop trigger if exists audit_otj on otj_penilaian;
create trigger audit_otj after delete on otj_penilaian for each row execute function audit_row();

-- ============ Fungsi: simpan konfirmasi Back Tracking ============
-- p_data: {toko_ada, penjualan_sesuai, jam_kunjungan, on_rayon, kunjungan_manual, pv_satu: {status, keterangan}, temuan_lain, hasil_diskusi}
create or replace function backtrack_simpan(p_visit uuid, p_lat float8, p_lng float8, p_acc float8, p_data jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare me profiles; v visits; o outlets; f profiles; d float8; k text; ind jsonb; st text; z text; baru uuid;
        ada boolean; sesuai boolean; ik jsonb := '{}';
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null or me.role not in ('mdm', 'rmdm', 'mds', 'tl', 'kormot') then
    raise exception 'Hanya MDM, RMDM, MDS, TL, dan Kormot yang bisa mengonfirmasi kunjungan.'; end if;
  select * into v from visits where id = p_visit;
  if not found
     or not (me.role = 'mdm'
          or (me.role in ('mds', 'rmdm') and v.cabang_id in (select my_cabang_ids()))
          or (me.role in ('tl', 'kormot') and exists (select 1 from profiles where id = v.frontliner_id and atasan_id = me.id)))
  then raise exception 'Kunjungan tidak ditemukan.'; end if;

  -- Isian wajib
  begin ada := (p_data ->> 'toko_ada')::boolean; sesuai := (p_data ->> 'penjualan_sesuai')::boolean;
  exception when others then ada := null; end;
  if ada is null or sesuai is null then raise exception 'Jawab dulu apakah toko ada dan apakah penjualannya sesuai.'; end if;
  foreach k in array array['jam_kunjungan', 'on_rayon', 'kunjungan_manual', 'pv_satu'] loop
    ind := p_data -> k;
    st := case when jsonb_typeof(ind) = 'object' then ind ->> 'status' end;
    if st is null or st not in ('Sesuai', 'TS', 'N/A') then raise exception 'Isi status (Sesuai / TS / N/A) untuk semua indikator.'; end if;
    ik := ik || jsonb_build_object(k, jsonb_build_object('status', st, 'keterangan', left(coalesce(ind ->> 'keterangan', ''), 500)));
  end loop;

  -- Wajib berada di outlet: jarak dihitung di sini dari koordinat outlet (toleransi akurasi GPS maksimal 30 m, sama seperti check-in).
  select * into o from outlets where id = v.outlet_id;
  if found and o.lat is not null and o.long is not null then
    if p_lat is null or p_lng is null then raise exception 'Lokasi Anda tidak terbaca. Aktifkan GPS lalu coba lagi.'; end if;
    d := jarak_m(p_lat, p_lng, o.lat, o.long);
    if d - least(coalesce(p_acc, 0), 30) > 50 then
      raise exception 'Anda % m dari outlet. Konfirmasi hanya bisa dilakukan di outlet (maksimal 50 m).', round(d); end if;
  end if;

  select * into f from profiles where id = v.frontliner_id;
  z := cabang_tz(v.cabang_id);
  insert into backtrack_konfirmasi (visit_id, cabang_id, frontliner_id, frontliner_user_id, frontliner_nama, outlet_id, outlet_kode, outlet_nama,
      visit_date, checkin_at, toko_ada, penjualan_sesuai, jam_kunjungan, on_rayon, kunjungan_manual, pv_satu, temuan_lain, hasil_diskusi,
      device_lat, device_lng, device_acc, jarak_m, oleh_id, oleh_user_id, oleh_nama, oleh_role)
    values (v.id, v.cabang_id, v.frontliner_id, f.user_id, f.nama, v.outlet_id, o.code, o.name,
      (v.checkin_at at time zone z)::date, v.checkin_at, ada, sesuai, ik -> 'jam_kunjungan', ik -> 'on_rayon', ik -> 'kunjungan_manual', ik -> 'pv_satu',
      left(coalesce(p_data ->> 'temuan_lain', ''), 1000), left(coalesce(p_data ->> 'hasil_diskusi', ''), 1000),
      p_lat, p_lng, p_acc, case when d is null then null else round(d)::int end, me.id, me.user_id, me.nama, me.role::text)
    returning id into baru;
  return baru;
exception when unique_violation then raise exception 'Kunjungan ini sudah dikonfirmasi.';
end $$;

-- ============ Fungsi: simpan hasil OTJ ============
-- p: {tipe, divisi, cabang_id, frontliner_id, tanggal, jawaban_pra, jawaban_pasca, kunjungan:[{outlet_id, outlet_nama, jawaban}],
--     akar_masalah:{pra,kunjungan,pasca}, action_plan:{pra,kunjungan,pasca}, skor}
create or replace function otj_simpan(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare me profiles; f profiles; cab uuid; tgl date; sk int; baru uuid; n int;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null or me.role not in ('mdm', 'rmdm', 'mds', 'tl', 'kormot') then
    raise exception 'Hanya MDM, RMDM, MDS, TL, dan Kormot yang bisa mengisi OTJ.'; end if;
  if length(p::text) > 300000 then raise exception 'Isian OTJ terlalu besar.'; end if;
  if (p ->> 'tipe') is null or (p ->> 'tipe') not in ('Taskforce', 'MD GT') then raise exception 'Tipe OTJ tidak dikenal.'; end if;
  begin cab := (p ->> 'cabang_id')::uuid; tgl := (p ->> 'tanggal')::date; exception when others then raise exception 'Cabang atau tanggal tidak valid.'; end;
  if cab is null or tgl is null then raise exception 'Cabang atau tanggal tidak valid.'; end if;
  if not (me.role = 'mdm' or cab in (select my_cabang_ids())) then raise exception 'Cabang ini di luar wewenang Anda.'; end if;
  if tgl > (now() at time zone cabang_tz(cab))::date then raise exception 'Tanggal tidak boleh di masa depan.'; end if;

  select * into f from profiles where id = nullif(p ->> 'frontliner_id', '')::uuid and role = 'frontliner' and cabang_id = cab;
  if not found then raise exception 'Frontliner yang dinilai tidak ditemukan di cabang ini.'; end if;
  if me.role in ('tl', 'kormot') and f.atasan_id is distinct from me.id then raise exception 'TL/Kormot hanya menilai frontliner bawahannya.'; end if;

  if jsonb_typeof(p -> 'kunjungan') is distinct from 'array' then raise exception 'Tambahkan minimal 1 toko yang dikunjungi.'; end if;
  n := jsonb_array_length(p -> 'kunjungan');
  if n < 1 then raise exception 'Tambahkan minimal 1 toko yang dikunjungi.'; end if;
  if n > 60 then raise exception 'Maksimal 60 toko dalam satu OTJ.'; end if;
  if jsonb_typeof(coalesce(p -> 'jawaban_pra', '{}')) <> 'object' or jsonb_typeof(coalesce(p -> 'jawaban_pasca', '{}')) <> 'object'
     or jsonb_typeof(coalesce(p -> 'akar_masalah', '{}')) <> 'object' or jsonb_typeof(coalesce(p -> 'action_plan', '{}')) <> 'object'
  then raise exception 'Format isian OTJ tidak valid.'; end if;
  begin sk := nullif(p ->> 'skor', '')::int; exception when others then sk := null; end;
  if sk is not null and (sk < 0 or sk > 100) then sk := null; end if;

  insert into otj_penilaian (tipe, divisi, cabang_id, frontliner_id, frontliner_user_id, frontliner_nama, tanggal,
      jawaban_pra, jawaban_pasca, kunjungan, akar_masalah, action_plan, skor, oleh_id, oleh_user_id, oleh_nama, oleh_role)
    values (p ->> 'tipe', left(coalesce(p ->> 'divisi', ''), 40), cab, f.id, f.user_id, f.nama, tgl,
      coalesce(p -> 'jawaban_pra', '{}'), coalesce(p -> 'jawaban_pasca', '{}'), p -> 'kunjungan',
      coalesce(p -> 'akar_masalah', '{}'), coalesce(p -> 'action_plan', '{}'), sk, me.id, me.user_id, me.nama, me.role::text)
    returning id into baru;
  return baru;
end $$;

revoke all on function backtrack_simpan(uuid, float8, float8, float8, jsonb), otj_simpan(jsonb) from public, anon;
grant execute on function backtrack_simpan(uuid, float8, float8, float8, jsonb), otj_simpan(jsonb) to authenticated;
