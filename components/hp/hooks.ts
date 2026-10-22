'use client'
// Hook untuk layar frontliner (/m). Dipisah dari halaman agar tiap bagian punya satu tanggung jawab dan bisa dibaca sendiri.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { startOfDay } from '../../lib/rekap'
import { kirimSemua, muat, type Hasil } from '../../lib/outbox'
import type { Kunjungan, Me, Outlet, Posisi, Produk, StokMap } from '../../lib/types'
import type { Snap } from '../../lib/snapshot'

export type Qty = Record<string, number>
const draftKey = (id: string) => `taskpro-draft-${id}`
export { draftKey }

// Izin dan posisi GPS.
export function useGps() {
  const [pos, setPos] = useState<Posisi | null>(null)
  const [gps, setGps] = useState<'wait' | 'ok' | 'denied' | 'nogeo'>('wait')
  const getPos = useCallback(() => {
    if (!navigator.geolocation) return setGps('nogeo')
    setGps('wait')
    navigator.geolocation.getCurrentPosition(
      p => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setGps('ok') },
      () => setGps('denied'), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
  }, [])
  return { pos, setPos, gps, getPos }
}

// Daftar outlet rayon terpilih dan penanda outlet yang sudah dikunjungi hari ini.
export function useOutlets(me: Me | null, visitId: string | undefined, tz: string) {
  const [rayon, setRayon] = useState(1)
  const [rows, setRows] = useState<Outlet[]>([])
  const [loading, setLoading] = useState(true)
  const [visited, setVisited] = useState<Set<number>>(new Set())
  const load = useCallback((keep?: boolean) => {
    if (!me) return
    if (keep !== true) setLoading(true)
    // dibaca berhalaman (1000 per permintaan) agar rayon besar tidak terpotong diam-diam
    ;(async () => {
      let all: Outlet[] = []
      for (let f = 0; ; f += 1000) {
        const { data } = await supabase.from('outlets').select('*').eq('kode_md', me.user_id).eq('rayon', rayon).eq('status', 'AKTIF').order('id').range(f, f + 999)
        all = all.concat((data || []) as Outlet[]); if (!data || data.length < 1000) break
      }
      setRows(all); setLoading(false)
    })()
  }, [me, rayon])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (me) supabase.from('visits').select('outlet_id').eq('frontliner_id', me.id).gte('checkin_at', startOfDay(tz))
      .then(({ data }) => setVisited(new Set((data || []).map((x: { outlet_id: number }) => x.outlet_id))))
  }, [me, visitId, tz])
  return { rayon, setRayon, rows, loading, load, visited }
}

// Stok pembawaan hari ini. Penjualan tidak boleh melebihi stok (dijaga juga di database). `cadangan`: salinan terakhir jika sedang offline.
export function useStok(me: Me | null, visitId: string | undefined, cadangan?: Pick<Snap, 'stok' | 'stokOn'> | null) {
  const [stok, setStok] = useState<StokMap>({})
  const [stokOn, setStokOn] = useState(true)            // saklar MDM di halaman Home
  const [missing, setMissing] = useState(false)         // migrasi 09 belum dijalankan: jangan memblokir
  const [siap, setSiap] = useState(false)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!me) return
    if (cadangan) { setStok(cadangan.stok); setStokOn(cadangan.stokOn); setSiap(true); return }   // mode offline: pakai salinan, tanpa menunggu jaringan
    let off = false; setSiap(false)
    supabase.rpc('stok_hari_ini', visitId ? { p_exclude: visitId } : {}).then(({ data, error }) => {
      if (off) return
      if (error) setMissing(true)
      setStok(Object.fromEntries((data || []).map((x: { product_id: string; dibawa: number; terjual: number }) => [x.product_id, { dibawa: x.dibawa, terjual: x.terjual }]))); setSiap(true)
    })
    return () => { off = true }
  }, [me, visitId, tick, !!cadangan])   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (me && !cadangan) supabase.from('settings').select('value').eq('key', 'stok_enforced').maybeSingle().then(({ data }) => { if (data) setStokOn(data.value === true) }) }, [me])
  const enforce = stokOn && !missing
  const sisaOf = (id: string) => (enforce ? Math.max(0, (stok[id]?.dibawa || 0) - (stok[id]?.terjual || 0)) : 9999)
  return { stok, stokOn, siap, enforce, sisaOf, segarkan: () => setTick(t => t + 1) }
}

// Draf penjualan: tersimpan otomatis per kunjungan, pulih saat halaman dimuat ulang, dan dihapus setelah check-out terkirim.
export function useDraft(visitId: string | undefined, qty: Qty, setQty: (q: Qty) => void) {
  const [draftId, setDraftId] = useState('')
  useEffect(() => {
    try {   // buang draf yang sudah lebih dari 3 hari
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i)!
        if (k.startsWith('taskpro-draft-')) { const d = JSON.parse(localStorage.getItem(k) || '{}'); if (!d.t || Date.now() - d.t > 3 * 864e5) localStorage.removeItem(k) }
      }
    } catch { /* abaikan */ }
  }, [])
  useEffect(() => {
    if (!visitId) { setDraftId(''); return }
    try { const d = JSON.parse(localStorage.getItem(draftKey(visitId)) || 'null'); if (d?.qty) setQty(d.qty) } catch { /* abaikan */ }
    setDraftId(visitId)
  }, [visitId])   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!visitId || draftId !== visitId) return
    try {
      if (Object.values(qty).some(v => v > 0)) localStorage.setItem(draftKey(visitId), JSON.stringify({ qty, t: Date.now() }))
      else localStorage.removeItem(draftKey(visitId))
    } catch { /* abaikan */ }
  }, [qty, draftId, visitId])
}

// Data pendukung kunjungan berjalan: daftar produk, jumlah kunjungan terakhir di outlet itu, produk fokus project, dan batas check-out.
// `cadangan`: salinan terakhir yang dipakai jika jaringan tidak ada.
export function useKonteks(me: Me | null, visit: Kunjungan | null, cadangan?: Snap | null) {
  const [products, setProducts] = useState<Produk[]>([])
  const [siap, setSiap] = useState(false)
  const [last, setLast] = useState<Qty>({})
  const [focusIds, setFocusIds] = useState<Set<string>>(new Set())   // produk fokus project frontliner (satu project saja)
  const [minCo, setMinCo] = useState(0)                               // batas minimal check-out (menit) yang diatur MDS/RMDM/MDM
  useEffect(() => {
    if (!visit || !me) return
    if (cadangan) { setProducts(cadangan.products); setSiap(true); return }                    // mode offline: pakai salinan, tanpa menunggu jaringan
    setSiap(false)
    supabase.from('products').select('*').eq('active', true).order('product').then(({ data, error }) => { setProducts(error ? [] : (data || []) as Produk[]); setSiap(true) })
    supabase.from('visits').select('sales(product_id,qty)').eq('outlet_id', visit.outlet_id).eq('frontliner_id', me.id).not('checkout_at', 'is', null)
      .order('checkin_at', { ascending: false }).limit(1).then(({ data }) => setLast(Object.fromEntries(((data?.[0] as { sales?: { product_id: string; qty: number }[] })?.sales || []).map(x => [x.product_id, x.qty]))))
  }, [visit?.id])   // eslint-disable-line react-hooks/exhaustive-deps
  // Produk fokus mengikuti project frontliner: saat kunjungan berjalan memakai project yang tercatat saat check-in
  useEffect(() => {
    if (!me) return
    if (cadangan) { setFocusIds(new Set(cadangan.focus)); return }
    let off = false
    ;(async () => {
      let pid = visit?.project_id
      if (!visit) { const { data } = await supabase.from('profiles').select('project_id').eq('id', me.id).maybeSingle(); pid = data?.project_id }
      if (!pid) { if (!off) setFocusIds(new Set()); return }
      const { data, error } = await supabase.from('project_focus').select('product_id').eq('project_id', pid)
      if (!off) setFocusIds(new Set(error ? [] : (data || []).map((x: { product_id: string }) => x.product_id)))
    })()
    return () => { off = true }
  }, [me?.id, visit?.id, !!cadangan])   // eslint-disable-line react-hooks/exhaustive-deps
  // Batas check-out: ambil nilai terbaru saat kunjungan dimulai. Server tetap menolak check-out yang terlalu cepat.
  useEffect(() => {
    if (visit && me && cadangan) setMinCo(cadangan.minCo)
    else if (visit && me) supabase.from('profiles').select('min_checkout_menit').eq('id', me.id).maybeSingle().then(({ data, error }) => setMinCo(error ? 0 : Number(data?.min_checkout_menit) || 0))
    else setMinCo(0)
  }, [visit?.id])   // eslint-disable-line react-hooks/exhaustive-deps
  return { products, siap, last, focusIds, minCo }
}

// Antrean check-out (lib/outbox): kirim ulang otomatis saat online, tiap 30 detik, dan saat aplikasi kembali ke layar.
export function useAntrean(aktif: boolean, onHasil: (h: Hasil) => void) {
  const [n, setN] = useState(0)
  const [mengirim, setMengirim] = useState(false)
  const kirim = useCallback(async () => {
    if (!muat().length) { setN(0); return }
    setMengirim(true)
    try { const h = await kirimSemua(supabase); setN(muat().length); if (h.terkirim.length || h.ditolak.length) onHasil(h) } finally { setMengirim(false) }
  }, [onHasil])
  useEffect(() => {
    setN(muat().length)
    if (!aktif) return
    kirim(); const t = setInterval(kirim, 30000)
    const vis = () => { if (document.visibilityState === 'visible') kirim() }
    window.addEventListener('online', kirim); document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(t); window.removeEventListener('online', kirim); document.removeEventListener('visibilitychange', vis) }
  }, [aktif, kirim])
  return { n, mengirim, kirim, segarkan: () => setN(muat().length) }
}
