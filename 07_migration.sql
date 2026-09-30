-- Migrasi 07: Outlet ID = 9 angka acak untuk SEMUA outlet. ID asal DMP dipindah ke src_id
-- (hanya untuk mencegah duplikat saat import ulang). Jalankan sekali.
alter table outlets add column src_id text;
update outlets set src_id = ext_id where ext_id is not null and ext_id !~ '^[0-9]{9}$';

create index outlets_ext_id_idx on outlets (ext_id);          -- mempercepat pengecekan saat membuat ID
do $$
declare r record; c text;
begin
  for r in select id from outlets where ext_id is null or ext_id !~ '^[0-9]{9}$' loop
    loop
      c := (100000000 + floor(random() * 900000000))::bigint::text;
      exit when not exists (select 1 from outlets where ext_id = c);
    end loop;
    update outlets set ext_id = c where id = r.id;
  end loop;
end $$;
drop index outlets_ext_id_idx;

create unique index outlets_ext_id_uq on outlets (ext_id);    -- Outlet ID tidak mungkin sama
alter table outlets add unique (cabang_id, src_id);           -- import ulang tidak menggandakan outlet
