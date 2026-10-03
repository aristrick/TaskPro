import { NextResponse } from 'next/server'
import { caller, fail, handler } from '../../../lib/server'
import { petakan } from '../../../lib/petakan'

// Alamat dari koordinat. Dua hal menjaga layanan peta gratis tetap aman dipakai:
// 1) hasil disimpan di tabel geocode_cache (koordinat dibulatkan 4 desimal, sekitar 11 m), jadi titik yang sama tidak ditanyakan dua kali;
// 2) permintaan ke layanan publik diberi jeda 1,1 detik (batas yang mereka tetapkan: 1 permintaan per detik) dan memakai identitas aplikasi.
let last = 0
let chain: Promise<unknown> = Promise.resolve()
const giliran = () => {
  const run = chain.then(async () => { const w = Math.max(0, last + 1100 - Date.now()); if (w) await new Promise(r => setTimeout(r, w)); last = Date.now() })
  chain = run.catch(() => {}); return run
}

export const GET = handler(async req => {
  const c = await caller(req); if (!c) return fail('Tidak diizinkan', 403)
  const lat = Number(req.nextUrl.searchParams.get('lat')), lng = Number(req.nextUrl.searchParams.get('lng'))
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return fail('Koordinat tidak valid')
  const la = Math.round(lat * 1e4) / 1e4, ln = Math.round(lng * 1e4) / 1e4
  const { data: hit } = await c.db.from('geocode_cache').select('hasil').eq('lat4', la).eq('lng4', ln).maybeSingle()
  if (hit) return NextResponse.json(hit.hasil)
  await giliran()
  const headers: Record<string, string> = { 'User-Agent': `TaskPro/1.0 (${process.env.GEOCODE_CONTACT || 'kontak belum diisi'})` }
  if (process.env.NEXT_PUBLIC_SITE_URL) headers.Referer = process.env.NEXT_PUBLIC_SITE_URL
  const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=id&lat=${la}&lon=${ln}`, { headers, signal: AbortSignal.timeout(8000) })
  if (!r.ok) return fail(`Layanan alamat sedang tidak tersedia (${r.status}). Isi manual.`, 502)
  const hasil = petakan(await r.json())
  await c.db.from('geocode_cache').upsert({ lat4: la, lng4: ln, hasil }, { onConflict: 'lat4,lng4' })
  return NextResponse.json(hasil)
})
