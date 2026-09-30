import { createClient } from '@supabase/supabase-js'
// Sesi disimpan di browser (localStorage) dan diperbarui otomatis, jadi refresh halaman tidak membuat logout.
export const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'taskpro-auth' } })
// Login memakai User ID (mis. 0300-TMTB01); Supabase Auth butuh email, jadi dipetakan.
export const toEmail = (userId: string) => userId.trim().toLowerCase() + '@taskpro.app'
