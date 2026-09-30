import { supabase } from './supabase'

// Panggil API internal. Mengembalikan '' jika sukses, atau pesan error yang bisa langsung ditampilkan.
export async function api(path: string, method: string, body: any): Promise<string> {
  try {
    const { data } = await supabase.auth.getSession()
    const r = await fetch(path, { method, body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session?.access_token } })
    if (r.ok) return ''
    let msg = ''; try { msg = (await r.json()).error } catch {}
    return msg || `Server menolak permintaan (kode ${r.status}). Periksa konfigurasi server.`
  } catch { return 'Tidak dapat menghubungi server. Periksa koneksi internet.' }
}
