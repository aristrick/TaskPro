import { supabase } from './supabase'
export { petakan } from './petakan'
// Alamat dari titik lat/long lewat server TaskPro (/api/geocode): hasil disimpan sementara dan laju ke layanan peta dijaga. Gagal = null (isi manual).
export async function alamatDari(lat: number, lng: number) {
  try {
    const { data } = await supabase.auth.getSession()
    const r = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`, { headers: { Authorization: 'Bearer ' + data.session?.access_token } })
    return r.ok ? await r.json() : null
  } catch { return null }
}
