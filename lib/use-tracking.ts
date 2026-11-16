'use client'
// Data dasar yang dipakai ketiga halaman Tracking Go: siapa yang login, cabang, dan frontliner yang boleh dilihatnya.
// Pembatasan akses dijaga oleh kebijakan RLS TaskPro (MDM semua; RMDM/MDS cabangnya; TL/Kormot bawahannya), bukan oleh kode ini.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { loadMe } from './auth'
import type { Me } from './types'

export type Cabang = { id: string; kode: string; nama: string; tz: string }
export type Frontliner = { id: string; user_id: string; nama: string; cabang_id: string }

// Pesan galat yang berarti tabel/fungsi Tracking Go belum ada di database (22_migration.sql belum dijalankan).
export const belumMigrasi22 = (msg: string | undefined | null) =>
  /backtrack_konfirmasi|otj_penilaian|backtrack_simpan|otj_simpan|schema cache|does not exist/i.test(msg || '')

export function useTrackingData() {
  const [me, setMe] = useState<Me | null>(null)
  const [cabs, setCabs] = useState<Cabang[]>([])
  const [fls, setFls] = useState<Frontliner[]>([])
  const [siap, setSiap] = useState(false)
  const [galat, setGalat] = useState('')
  useEffect(() => {
    let batal = false
    ;(async () => {
      const { me: p } = await loadMe()
      const [c, f] = await Promise.all([
        supabase.from('cabang').select('id,kode,nama,tz').order('kode'),
        supabase.from('profiles').select('id,user_id,nama,cabang_id').eq('role', 'frontliner').order('user_id'),
      ])
      if (batal) return
      setMe(p as Me | null)
      setCabs((c.data ?? []) as Cabang[]); setFls((f.data ?? []) as Frontliner[])
      setGalat(c.error?.message || f.error?.message || ''); setSiap(true)
    })()
    return () => { batal = true }
  }, [])
  return { me, cabs, fls, siap, galat }
}
