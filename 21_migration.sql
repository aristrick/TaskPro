-- 21_migration.sql: jam berlaku untuk aturan "Wajib dekat outlet" (radius 50 m).
-- Jalankan sekali di Supabase > SQL Editor. Aman dijalankan ulang.
--
-- Setelah ini MDM bisa membatasi aturan radius pada rentang jam tertentu (mis. 08:00-17:00).
--   * Di luar rentang jam: check-in dan input penjualan tidak dicek jaraknya.
--   * Jam dibaca menurut zona waktu cabang frontliner (WIB/WITA/WIT), bukan jam server.
--   * Rentang boleh melewati tengah malam (mis. 20:00-04:00). Dari = Sampai dianggap sepanjang hari.
--   * Saklar utama "radius_enforced" tetap berlaku: jika nonaktif, jam diabaikan.
-- Setting disimpan di tabel settings (key 'radius_jam'); hanya MDM yang boleh mengubah (kebijakan settings_write yang sudah ada).

insert into settings values ('radius_jam', '{"aktif": false, "dari": "08:00", "sampai": "17:00"}'::jsonb)
  on conflict (key) do nothing;

create or replace function cek_radius(p_outlet bigint, p_lat float8, p_lng float8, p_acc float8) returns void
language plpgsql security definer set search_path = public as $$
declare o outlets; on_ boolean; d float8; req boolean; j jsonb; t time; dari time; sampai time;
begin
  select gps_required into req from profiles where id = auth.uid();
  if req is false then return; end if;             -- frontliner yang dikecualikan MDM
  select (value #>> '{}')::boolean into on_ from settings where key = 'radius_enforced';
  if not coalesce(on_, true) then return; end if;
  -- Jam berlaku (opsional): di luar rentang, aturan radius tidak diterapkan
  select value into j from settings where key = 'radius_jam';
  if coalesce((j ->> 'aktif')::boolean, false) then
    t := (now() at time zone coalesce(user_tz(), 'Asia/Jakarta'))::time;
    dari := (j ->> 'dari')::time; sampai := (j ->> 'sampai')::time;
    if dari < sampai and not (t >= dari and t < sampai) then return; end if;
    if dari > sampai and not (t >= dari or t < sampai) then return; end if;
  end if;
  select * into o from outlets where id = p_outlet;
  if o.lat is null then raise exception 'Lokasi outlet belum ada. Minta MDS melengkapi koordinat outlet.'; end if;
  if p_lat is null then raise exception 'Lokasi Anda tidak terbaca.'; end if;
  d := jarak_m(p_lat, p_lng, o.lat, o.long);
  if d - least(coalesce(p_acc, 0), 30) > 50 then raise exception 'Anda % m dari outlet. Maksimal 50 m.', round(d); end if;
end $$;
