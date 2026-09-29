import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
// Login memakai User ID (mis. 0300-TMTB01); Supabase Auth butuh email, jadi dipetakan.
export const toEmail = (userId: string) => userId.trim().toLowerCase() + '@taskpro.app'
