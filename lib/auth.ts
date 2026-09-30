import { supabase } from './supabase'

let cache: any = null, inflight: Promise<{ me: any | null; error?: string }> | null = null
export const cachedMe = () => cache
export const clearMe = () => { cache = null; inflight = null }

// Ambil profil akun yang sedang login. Memakai sesi lokal (tanpa validasi jaringan) sehingga refresh tidak melempar ke login.
// Logout otomatis HANYA jika akunnya benar-benar sudah dihapus. Gangguan jaringan sesaat hanya menghasilkan `error`.
export function loadMe(): Promise<{ me: any | null; error?: string }> {
  if (cache) return Promise.resolve({ me: cache })
  if (inflight) return inflight
  inflight = (async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { me: null }
    let last = ''
    for (let i = 0; i < 3; i++) {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
      if (data) { cache = data; return { me: data } }
      if (!error) { await supabase.auth.signOut({ scope: 'local' }); return { me: null } }   // akun sudah dihapus
      last = error.message; await new Promise(r => setTimeout(r, 600 * (i + 1)))
    }
    return { me: null, error: last || 'Gagal memuat akun.' }
  })().finally(() => { inflight = null })
  return inflight
}
