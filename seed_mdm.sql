-- Jalankan SETELAH membuat user di Supabase > Authentication > Users > Add user
--   Email: mdm01@taskpro.app   Password: (pilih sendiri)   centang "Auto Confirm User"
insert into profiles (id, user_id, nama, role)
select id, 'MDM01', 'MDM Utama', 'mdm' from auth.users where email = 'mdm01@taskpro.app';
