-- OPSIONAL. Jalankan SETELAH 06_migration.sql dan SEBELUM menambah outlet baru.
-- Mengubah kode outlet lama (mis. 0300-0000001) ke format baru (0300-TMTB01-000000001)
-- dan mengisi Outlet ID acak 9 digit untuk outlet yang belum punya.
do $$ declare r record; c text; begin
  for r in select id from outlets where ext_id is null loop
    loop c := (100000000 + floor(random() * 900000000))::bigint::text; exit when not exists (select 1 from outlets where ext_id = c); end loop;
    update outlets set ext_id = c where id = r.id;
  end loop; end $$;

with n as (
  select o.id, c.kode || '-' || split_part(o.kode_md, '-', 2) || '-' ||
         lpad((row_number() over (partition by o.kode_md order by o.id))::text, 9, '0') as newcode
  from outlets o join cabang c on c.id = o.cabang_id where o.kode_md is not null)
update outlets o set code = n.newcode from n where o.id = n.id;

insert into md_seq (kode_md, seq) select kode_md, count(*) from outlets where kode_md is not null group by kode_md
  on conflict (kode_md) do update set seq = excluded.seq;
