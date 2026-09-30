import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { clearMe } from './auth'

// Jendela "aktif" (menit). Harus sama dengan interval di 08_migration.sql (fungsi sesi_klaim).
export const AKTIF_MENIT = 10
const KEY = 'taskpro-device', FLAG = 'taskpro-claimed'

export function deviceId() {
  let d = localStorage.getItem(KEY)
  if (!d) { d = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)); localStorage.setItem(KEY, d) }
  return d
}
const belumMigrasi = (e: any) => e?.code === 'PGRST202' || /Could not find the function/i.test(e?.message || '')

// Daftarkan perangkat ini sebagai sesi aktif. Frontliner ditolak jika akunnya aktif di perangkat lain. '' = berhasil.
export async function klaim(): Promise<string> {
  const { error } = await supabase.rpc('sesi_klaim', { p_device: deviceId(), p_ua: navigator.userAgent.slice(0, 200) })
  if (!error) { localStorage.setItem(FLAG, '1'); return '' }
  if (belumMigrasi(error)) { console.warn('08_migration.sql belum dijalankan; kontrol sesi dilewati.'); return '' }
  return error.message.includes('AKUN_AKTIF')
    ? 'Akun ini sedang aktif di perangkat lain. Logout dulu dari perangkat tersebut, atau minta MDS/RMDM/MDM untuk melogout akun ini.'
    : error.message
}
// true = sesi valid, false = sesi sudah diakhiri, null = tidak bisa dipastikan (jaringan): jangan logout.
async function detak(): Promise<boolean | null> {
  const { data, error } = await supabase.rpc('sesi_detak', { p_device: deviceId() })
  if (error) return null
  return data === true
}

export async function logout() {
  try { await supabase.rpc('sesi_lepas', { p_device: deviceId() }) } catch {}
  localStorage.removeItem(FLAG); clearMe()
  await supabase.auth.signOut({ scope: 'local' })   // hanya perangkat ini; perangkat lain tidak ikut keluar
}
export async function keluarLokal() { localStorage.removeItem(FLAG); clearMe(); await supabase.auth.signOut({ scope: 'local' }) }

// Denyut berkala: menandai akun aktif, dan mendeteksi jika sesi diakhiri (login di perangkat lain / logout paksa oleh admin).
export function useHeartbeat(on: boolean, onKicked: () => void) {
  const cb = useRef(onKicked); cb.current = onKicked
  useEffect(() => {
    if (!on) return
    let stop = false
    const tick = async () => {
      const ok = await detak(); if (stop || ok !== false) return
      if (localStorage.getItem(FLAG)) return cb.current()      // sebelumnya terdaftar, sekarang hilang = diakhiri
      const m = await klaim(); if (m && !stop) cb.current()     // sesi lama sebelum fitur ini ada: daftarkan sekarang
    }
    tick(); const t = setInterval(tick, 45000)
    const vis = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', vis)
    return () => { stop = true; clearInterval(t); document.removeEventListener('visibilitychange', vis) }
  }, [on])
}

// Peta user_id -> waktu terakhir aktif, untuk akun yang boleh dilihat pemanggil (dibatasi RLS).
export async function muatAktif(): Promise<Record<string, string>> {
  const since = new Date(Date.now() - AKTIF_MENIT * 60000).toISOString()
  const { data } = await supabase.from('device_sessions').select('user_id,last_seen').gt('last_seen', since)
  const m: Record<string, string> = {}
  ;(data || []).forEach((x: any) => { if (!m[x.user_id] || x.last_seen > m[x.user_id]) m[x.user_id] = x.last_seen })
  return m
}
export function useAktif() {
  const [m, setM] = useState<Record<string, string>>({})
  useEffect(() => { let off = false; const go = () => muatAktif().then(x => !off && setM(x)); go(); const t = setInterval(go, 30000); return () => { off = true; clearInterval(t) } }, [])
  return [m, () => muatAktif().then(setM)] as const
}
