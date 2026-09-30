-- Migrasi 06: Outlet ID acak 9 digit, kode outlet baru (cabang-kodeMD-urutan9), kolom kelurahan,
-- pengecualian GPS per frontliner, dan daftar Kode MD. Jalankan sekali di SQL Editor.
alter table outlets  add column village text;
alter table profiles add column gps_required boolean not null default true;   -- false = dikecualikan dari GPS wajib dan batas 50 m

create table md_seq (kode_md text primary key, seq int not null default 0);   -- urutan pendaftaran outlet per Kode MD
alter table md_seq enable row level security;                                  -- tanpa policy: hanya trigger yang menulis

create or replace function set_outlet_code() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text; n int; c text;
begin
  if new.ext_id is null then                       -- Outlet ID: 9 angka acak, dijamin belum dipakai
    loop
      c := (100000000 + floor(random() * 900000000))::bigint::text;
      exit when not exists (select 1 from outlets where ext_id = c);
    end loop;
    new.ext_id := c;
  end if;
  if new.code is null then
    select kode into k from cabang where id = new.cabang_id;
    if new.kode_md is not null then                -- contoh: 0300-TMTB01-000000001
      insert into md_seq values (new.kode_md, 1)
        on conflict (kode_md) do update set seq = md_seq.seq + 1 returning seq into n;
      new.code := k || '-' || split_part(new.kode_md, '-', 2) || '-' || lpad(n::text, 9, '0');
    else
      update cabang set outlet_seq = outlet_seq + 1 where id = new.cabang_id returning outlet_seq into n;
      new.code := k || '-' || lpad(n::text, 7, '0');
    end if;
  end if;
  return new;
end $$;

create function kode_md_list() returns setof text language sql stable as $$
  select distinct kode_md from outlets where kode_md is not null order by 1 $$;   -- mengikuti RLS: hanya cabang akun itu

create or replace function cek_radius(p_outlet bigint, p_lat float8, p_lng float8, p_acc float8) returns void
language plpgsql security definer set search_path = public as $$
declare o outlets; on_ boolean; d float8; req boolean;
begin
  select gps_required into req from profiles where id = auth.uid();
  if req is false then return; end if;             -- frontliner yang dikecualikan MDM
  select (value #>> '{}')::boolean into on_ from settings where key = 'radius_enforced';
  if not coalesce(on_, true) then return; end if;
  select * into o from outlets where id = p_outlet;
  if o.lat is null then raise exception 'Lokasi outlet belum ada. Minta MDS melengkapi koordinat outlet.'; end if;
  if p_lat is null then raise exception 'Lokasi Anda tidak terbaca.'; end if;
  d := jarak_m(p_lat, p_lng, o.lat, o.long);
  if d - least(coalesce(p_acc, 0), 30) > 50 then raise exception 'Anda % m dari outlet. Maksimal 50 m.', round(d); end if;
end $$;
