-- Migrasi 15: performa. Jalankan sekali.
-- (A) Fungsi akses (my_role, auth.uid) di kebijakan RLS dibungkus (select ...) agar dihitung SEKALI per query, bukan sekali per baris.
--     Logika akses tidak berubah. Pada 45.000 outlet, ini menurunkan hitung outlet dari ratusan milidetik; pola yang sama dipakai di tabel lain.
-- (B) rekap_saya: ringkasan 35 hari milik frontliner dihitung di database (puluhan KB), menggantikan unduhan ratusan KB per buka tab Rekap.

-- (A) Kebijakan yang ditulis ulang (dihasilkan dari kondisi database sebenarnya):
drop policy "cabang_read" on cabang;
create policy "cabang_read" on cabang for select
  using ((((select my_role()) = 'mdm'::user_role) OR (id IN ( SELECT my_cabang_ids() AS my_cabang_ids))));

drop policy "cabang_write" on cabang;
create policy "cabang_write" on cabang for all
  using ((((select my_role()) = 'mdm'::user_role) OR (((select my_role()) = 'rmdm'::user_role) AND (rmdm_id = (select auth.uid())))))
  with check ((((select my_role()) = 'mdm'::user_role) OR (((select my_role()) = 'rmdm'::user_role) AND (rmdm_id = (select auth.uid())))));

drop policy "outlets_read" on outlets;
create policy "outlets_read" on outlets for select
  using ((((select my_role()) = 'mdm'::user_role) OR (((select my_role()) = ANY (ARRAY['mds'::user_role, 'rmdm'::user_role, 'tl'::user_role, 'kormot'::user_role])) AND (cabang_id IN ( SELECT my_cabang_ids() AS my_cabang_ids))) OR (((select my_role()) = 'frontliner'::user_role) AND (kode_md = ( SELECT profiles.user_id    FROM profiles   WHERE (profiles.id = (select auth.uid())))))));

drop policy "outlets_write" on outlets;
create policy "outlets_write" on outlets for all
  using ((((select my_role()) = 'mdm'::user_role) OR (((select my_role()) = ANY (ARRAY['mds'::user_role, 'rmdm'::user_role, 'tl'::user_role, 'kormot'::user_role])) AND (cabang_id IN ( SELECT my_cabang_ids() AS my_cabang_ids))) OR (((select my_role()) = 'frontliner'::user_role) AND (kode_md = ( SELECT profiles.user_id    FROM profiles   WHERE (profiles.id = (select auth.uid())))))))
  with check ((((select my_role()) = 'mdm'::user_role) OR (((select my_role()) = ANY (ARRAY['mds'::user_role, 'rmdm'::user_role, 'tl'::user_role, 'kormot'::user_role])) AND (cabang_id IN ( SELECT my_cabang_ids() AS my_cabang_ids))) OR (((select my_role()) = 'frontliner'::user_role) AND (kode_md = ( SELECT profiles.user_id    FROM profiles   WHERE (profiles.id = (select auth.uid())))))));

drop policy "products_read" on products;
create policy "products_read" on products for select
  using (((select auth.uid()) IS NOT NULL));

drop policy "products_write" on products;
create policy "products_write" on products for all
  using (((select my_role()) = ANY (ARRAY['mdm'::user_role, 'rmdm'::user_role, 'mds'::user_role])))
  with check (((select my_role()) = ANY (ARRAY['mdm'::user_role, 'rmdm'::user_role, 'mds'::user_role])));

drop policy "profiles_read" on profiles;
create policy "profiles_read" on profiles for select
  using ((((select my_role()) = 'mdm'::user_role) OR (atasan_id = (select auth.uid())) OR (((select my_role()) = ANY (ARRAY['mds'::user_role, 'rmdm'::user_role])) AND (cabang_id IN ( SELECT my_cabang_ids() AS my_cabang_ids))) OR (((select my_role()) = 'rmdm'::user_role) AND (role = 'mds'::user_role))));

drop policy "profiles_self" on profiles;
create policy "profiles_self" on profiles for select
  using ((id = (select auth.uid())));

drop policy "pfocus_read" on project_focus;
create policy "pfocus_read" on project_focus for select
  using (((project_id IN ( SELECT projects.id    FROM projects)) OR (project_id = ( SELECT profiles.project_id    FROM profiles   WHERE (profiles.id = (select auth.uid()))))));

drop policy "settings_read" on settings;
create policy "settings_read" on settings for select
  using (((select auth.uid()) IS NOT NULL));

drop policy "settings_write" on settings;
create policy "settings_write" on settings for update
  using (((select my_role()) = 'mdm'::user_role))
  with check (((select my_role()) = 'mdm'::user_role));

drop policy "visits_read" on visits;
create policy "visits_read" on visits for select
  using (((frontliner_id = (select auth.uid())) OR ((select my_role()) = 'mdm'::user_role) OR (((select my_role()) = ANY (ARRAY['mds'::user_role, 'rmdm'::user_role])) AND (cabang_id IN ( SELECT my_cabang_ids() AS my_cabang_ids))) OR (frontliner_id IN ( SELECT profiles.id    FROM profiles   WHERE (profiles.atasan_id = (select auth.uid()))))));

-- (B) Rekap harian milik pengguna yang login (frontliner), bentuknya sama dengan rekap() di aplikasi, termasuk daftar outlet per hari.
create function rekap_saya(p_from timestamptz) returns jsonb language sql stable as $$
  with v as (select v.id, v.outlet_id, (v.checkin_at at time zone cb.tz)::date as d from visits v join cabang cb on cb.id = v.cabang_id
             where v.frontliner_id = (select auth.uid()) and v.checkin_at >= p_from),
  sl as (select v.d, v.outlet_id, coalesce(o.name, '-') as oname, pr.product, s.is_focus, s.qty, s.value
         from sales s join v on v.id = s.visit_id join products pr on pr.id = s.product_id left join outlets o on o.id = v.outlet_id),
  dy as (select d, count(*) as visits from v group by d),
  oc as (select d, count(distinct outlet_id) as oc, sum(value) as value from sl group by d),
  pd as (select d, product, bool_or(is_focus) as focus, sum(qty) as qty, sum(value) as value, count(distinct outlet_id) as ec from sl group by d, product),
  od as (select d, outlet_id, min(oname) as nama, sum(value) as value from sl group by d, outlet_id)
  select coalesce(jsonb_object_agg(dy.d, jsonb_build_object('visits', dy.visits, 'oc', coalesce(oc.oc, 0), 'value', coalesce(oc.value, 0),
    'outlets', coalesce((select jsonb_agg(jsonb_build_object('name', od.nama, 'value', od.value) order by od.value desc) from od where od.d = dy.d), '[]'::jsonb),
    'prod', coalesce((select jsonb_object_agg(pd.product, jsonb_build_object('qty', pd.qty, 'value', pd.value, 'focus', pd.focus, 'ec', pd.ec)) from pd where pd.d = dy.d), '{}'::jsonb))), '{}'::jsonb)
  from dy left join oc on oc.d = dy.d $$;
revoke execute on function rekap_saya(timestamptz) from public, anon;
grant execute on function rekap_saya(timestamptz) to authenticated;
