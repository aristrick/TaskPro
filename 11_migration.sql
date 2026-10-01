-- Migrasi 11: produk fokus per project. Satu frontliner hanya di satu project, jadi produk fokusnya mengikuti project itu.
-- Status fokus dicatat pada tiap baris penjualan saat transaksi, sehingga perubahan fokus tidak mengubah riwayat. Jalankan sekali.
create table project_focus (
  project_id uuid not null references projects(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  primary key (project_id, product_id));
alter table project_focus enable row level security;
create policy pfocus_read on project_focus for select using (
  project_id in (select id from projects)                                              -- admin: project dalam wewenangnya
  or project_id = (select project_id from profiles where id = auth.uid()));            -- frontliner: project miliknya
create policy pfocus_write on project_focus for all
  using      ((select my_role()) in ('mdm', 'mds', 'rmdm') and project_id in (select id from projects))
  with check ((select my_role()) in ('mdm', 'mds', 'rmdm') and project_id in (select id from projects));

-- Peralihan: tanda fokus global lama disalin ke semua project yang sudah ada; riwayat penjualan dicap sesuai tanda lama.
insert into project_focus select pr.id, p.id from projects pr cross join products p where p.is_focus on conflict do nothing;
alter table sales add column is_focus boolean not null default false;
update sales s set is_focus = p.is_focus from products p where p.id = s.product_id;

create or replace function save_sales(p_visit uuid, p_items jsonb, p_lat float8, p_lng float8, p_acc float8) returns void
language plpgsql security definer set search_path = public as $$
declare v visits; it jsonb; p products; on_ boolean; d date; carried int; sold int; q int;
begin
  select * into v from visits where id = p_visit and frontliner_id = auth.uid() and checkout_at is null;
  if not found then raise exception 'Kunjungan tidak aktif.'; end if;
  perform cek_radius(v.outlet_id, p_lat, p_lng, p_acc);
  select coalesce((value #>> '{}')::boolean, true) into on_ from settings where key = 'stok_enforced';
  d := (v.checkin_at at time zone 'Asia/Jakarta')::date;
  delete from sales where visit_id = p_visit;          -- seluruh fungsi satu transaksi: jika stok kurang, penjualan lama tetap utuh
  for it in select * from jsonb_array_elements(p_items) loop
    q := (it ->> 'qty')::int;
    if q > 0 then
      select * into p from products where id = (it ->> 'product_id')::uuid and active;
      if found then
        if coalesce(on_, true) then
          select coalesce(sum(qty), 0) into carried from carry_stock
            where frontliner_id = v.frontliner_id and stock_date = d and product_id = p.id;
          select coalesce(sum(s.qty), 0) into sold from sales s join visits x on x.id = s.visit_id
            where x.frontliner_id = v.frontliner_id and (x.checkin_at at time zone 'Asia/Jakarta')::date = d and s.product_id = p.id;
          if sold + q > carried then
            raise exception 'Stok % tidak cukup. Sisa % pcs, diminta % pcs.', p.product, greatest(carried - sold, 0), q;
          end if;
        end if;
        insert into sales (visit_id, product_id, qty, price, is_focus) values (p_visit, p.id, q, p.price,
          exists (select 1 from project_focus pf where pf.project_id = v.project_id and pf.product_id = p.id));
      end if;
    end if;
  end loop;
end $$;

grant execute on function save_sales(uuid, jsonb, float8, float8, float8) to authenticated;
