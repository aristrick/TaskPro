'use client'
// Layar frontliner (HP). Halaman ini hanya mengatur alur: login, GPS, check-in, check-out, antrean kirim, dan tab.
// Tampilannya ada di components/hp/*, pengambilan datanya di components/hp/hooks.ts, antrean sinyal lemah di lib/outbox.ts.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { loadMe } from '../../lib/auth'
import { logout, keluarLokal, useHeartbeat } from '../../lib/sesi'
import { useDialog } from '../../components/Dialog'
import { rekap, VSEL, startOfDay, fetchAll } from '../../lib/rekap'
import { friendly } from '../../lib/friendly'
import StokForm from '../../components/StokForm'
import RekapTab from '../../components/hp/RekapTab'
import ProfileTab from '../../components/hp/ProfileTab'
import ReceiptDialog from '../../components/ReceiptDialog'
import PrinterSettings from '../../components/PrinterSettings'
import SellScreen from '../../components/hp/SellScreen'
import OutletList from '../../components/hp/OutletList'
import FarDialog, { type Jauh } from '../../components/hp/FarDialog'
import { OfflineBar, OutboxBar } from '../../components/hp/Bars'
import { draftKey, useAntrean, useDraft, useGps, useKonteks, useOutlets, useStok, type Qty } from '../../components/hp/hooks'
import { muatPref, prefBawaan, simpanTerakhir, muatTerakhir, type Pref } from '../../lib/printer'
import type { Struk } from '../../lib/escpos'
import { PageLoader } from '../../components/Loaders'
import Icon from '../../components/Icon'
import { fresh, payload, buzz, sisaDetik, mmss } from '../../lib/hp'
import { susunStruk } from '../../lib/struk'
import { antre, adaUntuk, galatJaringan, muat, type Hasil } from '../../lib/outbox'
import { hapusSnap, muatSnap, simpanSnap, type Snap } from '../../lib/snapshot'
import type { Kunjungan, Me, Outlet } from '../../lib/types'

const VISIT_SEL = 'id,outlet_id,checkin_at,project_id,outlets(name,address,lat,long)'

export default function Frontliner() {
  const router = useRouter(), dlg = useDialog()
  const [me, setMe] = useState<Me | null>(null)
  const [tab, setTab] = useState<'sell' | 'rekap' | 'profile'>('sell')
  const [visit, setVisit] = useState<Kunjungan | null>(null)
  const [visitSiap, setVisitSiap] = useState(false)       // true setelah status kunjungan berjalan diketahui (dari server atau salinan)
  const [qty, setQty] = useState<Qty>({})
  const [rk, setRk] = useState<Record<string, any> | null>(null)
  const [sel, setSel] = useState('')
  const [sub, setSub] = useState('')
  const [anim, setAnim] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [toast, setToast] = useState('')
  const [far, setFar] = useState<Jauh | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [tz, setTz] = useState('Asia/Jakarta')                // zona waktu cabang frontliner (WIB/WITA/WIT)
  const [pref, setPref] = useState<Pref>(prefBawaan())        // pengaturan printer (tersimpan di perangkat)
  const [struk, setStruk] = useState<Struk | null>(null)      // struk yang sedang ditawarkan untuk dicetak
  const [terakhir, setTerakhir] = useState<Struk | null>(null) // struk terakhir, untuk cetak ulang
  const [prefOpen, setPrefOpen] = useState(false)
  const [stokOpen, setStokOpen] = useState(false)
  const [snap, setSnap] = useState<Snap | null>(null)         // terisi jika aplikasi dibuka tanpa sinyal memakai salinan terakhir

  const { pos, setPos, gps, getPos } = useGps()
  const o = useOutlets(me, visit?.id, tz)
  const stokH = useStok(me, visit?.id, snap)
  const ctx = useKonteks(me, visit, snap)
  useDraft(visit?.id, qty, setQty)

  const say = (t: string) => { buzz(18); setTimeout(() => { setToast(t); setTimeout(() => setToast(''), 2200) }, 350) }
  const loadVisit = async (uid: string, a = '') => {
    const { data, error } = await supabase.from('visits').select(VISIT_SEL).eq('frontliner_id', uid).is('checkout_at', null).maybeSingle()
    if (error) return false                                  // gangguan jaringan: jangan menghapus kunjungan yang sedang tampil
    setAnim(a); setVisit(data && !adaUntuk(data.id) ? (data as unknown as Kunjungan) : null); setVisitSiap(true); return true   // kunjungan yang check-out-nya sedang mengantre dianggap selesai
  }

  // ---- Antrean check-out (sinyal lemah) ----
  const hasilRef = useRef<(h: Hasil) => void>(() => {})
  hasilRef.current = async h => {
    for (const t of h.terkirim) { try { localStorage.removeItem(draftKey(t.visit_id)) } catch { /* abaikan */ } }
    if (h.terkirim.length) say(h.terkirim.length === 1 ? 'Check-out terkirim' : `${h.terkirim.length} check-out terkirim`)
    for (const d of h.ditolak) await dlg.alert({ title: 'Penjualan belum bisa dikirim', icon: 'alert', tone: 'danger', message: <>Kunjungan di <b>{d.item.outlet}</b> ditolak server: {d.pesan} Kunjungan dibuka kembali dengan isian terakhir Anda. Perbaiki lalu check-out lagi.</> })
    if (me && h.ditolak.length) await loadVisit(me.id)
    stokH.segarkan()
  }
  const onHasil = useCallback((h: Hasil) => hasilRef.current(h), [])
  const antrean = useAntrean(!!me, onHasil)

  useHeartbeat(!!me, async () => {
    await dlg.alert({ title: 'Sesi berakhir', icon: 'logout', message: 'Akun Anda keluar karena login di perangkat lain atau sesinya diakhiri admin.' })
    await keluarLokal(); router.replace('/login')
  })
  async function keluarAkun() {
    if (!(await dlg.confirm({ title: 'Keluar dari akun?', icon: 'logout', tone: 'danger', okText: 'Log out', message: 'Anda perlu login lagi untuk memakai TaskPro di perangkat ini.' }))) return
    await logout(); router.replace('/login')
  }

  // ---- Memuat akun. Tanpa sinyal: pakai salinan kunjungan terakhir bila ada ----
  // Supabase mencoba ulang permintaan yang gagal (jeda 1, 2, 4 detik), jadi loadMe tanpa sinyal baru menyerah setelah puluhan detik.
  // Karena itu salinan dipakai segera jika HP jelas offline, atau setelah 6 detik jika sinyal hanya lemah. Jika data asli tiba kemudian, itu yang dipakai.
  const dariSalinan = useRef(false)
  useEffect(() => {
    const pakaiSalinan = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const s = session ? muatSnap(session.user.id) : null
      if (!s || adaUntuk(s.visit.id) || dariSalinan.current) return !!s
      dariSalinan.current = true; setSnap(s); setMe(s.me); setVisit(s.visit); setTz(s.tz); setVisitSiap(true); return true
    }
    let selesai = false
    const t = setTimeout(() => { if (!selesai) pakaiSalinan() }, navigator.onLine ? 6000 : 0)
    loadMe().then(async ({ me: p, error }) => {
      selesai = true; clearTimeout(t)
      if (error) { if (!dariSalinan.current && !(await pakaiSalinan())) setLoadErr(error); return }
      if (!p) return router.replace('/login')
      if (p.role !== 'frontliner') return router.replace('/')
      dariSalinan.current = false; setSnap(null); setMe(p as Me); loadVisit(p.id)
    })
    o.setRayon(+(localStorage.getItem('rayon') || 1)); getPos()
    return () => clearTimeout(t)
  }, [router])   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPref(muatPref()); setTerakhir(muatTerakhir()) }, [])
  useEffect(() => { if (me?.cabang_id) supabase.from('cabang').select('tz').eq('id', me.cabang_id).maybeSingle().then(({ data }) => { if (data?.tz) setTz(data.tz) }) }, [me?.id])   // eslint-disable-line react-hooks/exhaustive-deps

  // Salinan kunjungan berjalan (untuk membuka aplikasi tanpa sinyal). Dihapus saat tidak ada kunjungan berjalan.
  useEffect(() => {
    if (!me || !visitSiap) return
    if (!visit) { hapusSnap(me.id); return }
    if (ctx.siap) simpanSnap({ t: Date.now(), me, visit, products: ctx.products, focus: [...ctx.focusIds], minCo: ctx.minCo, tz, stok: stokH.stok, stokOn: stokH.stokOn })
  }, [me, visitSiap, visit, ctx.siap, ctx.products, ctx.focusIds, ctx.minCo, tz, stokH.stok, stokH.stokOn])

  // Rekap 35 hari. Cara baru: ringkasan dihitung di database. Cadangan jika migrasi 15 belum dijalankan: unduh baris kunjungan (berhalaman) dan hitung di HP.
  useEffect(() => {
    if (tab !== 'rekap' || !me) return
    supabase.rpc('rekap_saya', { p_from: startOfDay(tz, 35) }).then(async ({ data, error }) => {
      if (!error && data) return setRk(data)
      try { setRk(rekap(await fetchAll((a, b) => supabase.from('visits').select(VSEL).eq('frontliner_id', me.id).gte('checkin_at', startOfDay(tz, 35)).order('checkin_at').range(a, b)))) } catch { setRk({}) }
    })
  }, [tab, me, tz])

  // ---- Check-in dan check-out ----
  // Frontliner yang dikecualikan MDM boleh tanpa GPS: posisi kosong dan server tidak menerapkan batas 50 m
  const geo = async () => { try { return await fresh() } catch (e) { if (me?.gps_required === false) return null; throw e } }
  const jauh = (e: any, name: string, lat: number | null | undefined, long: number | null | undefined) => {
    const m = /Anda (\d+) m dari outlet/.exec(e?.message || ''); if (!m) return false
    setFar({ name, d: +m[1], lat, long }); return true
  }
  async function masuk(r: Outlet) {
    if (!me) return
    if (!(await dlg.confirm({ title: 'Check-in di outlet ini?', icon: 'pin', okText: 'Check-in', message: <>Mulai kunjungan di <b>{r.name}</b>.</> }))) return
    setBusy(true); setBusyId(r.id); setErr('')
    try {
      if (muat().length) {   // kunjungan sebelumnya masih mengantre: kirim dulu, karena server hanya mengizinkan satu kunjungan berjalan
        await antrean.kirim()
        if (muat().length) throw new Error('Masih ada kunjungan yang menunggu dikirim. Check-in baru bisa setelah terkirim. Pastikan ada sinyal, lalu coba lagi.')
      }
      const p = await geo(); if (p) setPos({ lat: p.coords.latitude, lng: p.coords.longitude })
      const { error } = await supabase.rpc('checkin', { p_outlet: r.id, ...payload(p) }); if (error) throw error
      setQty({}); await loadVisit(me.id, 'fwd'); buzz()
    } catch (e: any) { if (!jauh(e, r.name, r.lat, r.long)) setErr(friendly(e, 'Gagal membaca lokasi')) }
    setBusy(false); setBusyId(null)
  }
  const selesai = (baru: Struk | null, pesan: string) => {
    if (baru) { simpanTerakhir(baru); setTerakhir(baru); if (pref.tanya) setStruk(baru) }
    setAnim('back'); setVisit(null); setQty({}); say(pesan)
  }
  async function keluar() {
    if (!visit || !me) return
    const sisa = sisaDetik(visit.checkin_at, ctx.minCo)
    if (sisa > 0) { setErr(`Check-out baru bisa dilakukan ${ctx.minCo} menit setelah check-in. Tunggu ${mmss(sisa)} lagi.`); return }
    // Struk disusun sekarang, selagi daftar produk dan jumlahnya masih ada (keadaan direset setelah check-out)
    const baru = susunStruk({ judul: pref.judul, footer: pref.footer, visit, me, produk: ctx.products, qty, tz })
    const items = ctx.products.filter(x => qty[x.id] > 0).map(x => ({ product_id: x.id, qty: qty[x.id] }))
    const at = new Date().toISOString()   // waktu check-out sebenarnya (dipakai jika harus diantrekan)
    setBusy(true); setErr('')
    let p: GeolocationPosition | null = null, tahap: 'gps' | 'kirim' = 'gps'
    try {
      if (items.length) p = await geo()
      tahap = 'kirim'
      if (items.length) { const { error } = await supabase.rpc('save_sales', { p_visit: visit.id, p_items: items, ...payload(p) }); if (error) throw error }
      const { error } = await supabase.rpc('checkout', { p_visit: visit.id }); if (error) throw error
      try { localStorage.removeItem(draftKey(visit.id)) } catch { /* abaikan */ }
      selesai(baru, 'Check-out berhasil')
    } catch (e: any) {
      if (tahap === 'kirim' && (galatJaringan(e) || !navigator.onLine)) {
        // Sinyal hilang: simpan di HP dan kirim otomatis nanti. Draf tetap disimpan sampai terkirim (jika ditolak, isian bisa dipulihkan).
        antre({ visit_id: visit.id, items, lat: p?.coords.latitude ?? null, lng: p?.coords.longitude ?? null, acc: p?.coords.accuracy ?? null, at, outlet: visit.outlets?.name || '', dibuat: Date.now() })
        hapusSnap(me.id); antrean.segarkan(); selesai(baru, 'Tersimpan di HP. Dikirim otomatis saat sinyal kembali')
      } else if (!jauh(e, visit.outlets?.name || '', visit.outlets?.lat, visit.outlets?.long)) setErr(friendly(e, 'Gagal membaca lokasi'))
    }
    setBusy(false)
  }

  // ---- Tampilan ----
  const stokSum = Object.values(stokH.stok).reduce((a, x) => (x.dibawa > 0 ? { n: a.n + 1, pcs: a.pcs + x.dibawa, sisa: a.sisa + x.dibawa - x.terjual } : a), { n: 0, pcs: 0, sisa: 0 })
  const backRekap = () => { if (sel) { setSub('back'); setSel('') } else { setSub(''); setTab('sell') } }

  if (loadErr) return <div className="gate"><h2>Gagal memuat akun</h2><p className="muted">{loadErr}</p><button onClick={() => location.reload()}>Coba lagi</button></div>
  if (!me) return <PageLoader text="Memuat…" />
  if (gps !== 'ok' && me.gps_required !== false) return (
    <div className="gate">
      <h2>Aktifkan Lokasi (GPS)</h2>
      <p className="muted">{gps === 'wait' ? 'Meminta izin lokasi…' : gps === 'nogeo' ? 'Perangkat ini tidak mendukung GPS.'
        : 'TaskPro butuh lokasi Anda untuk menghitung jarak ke outlet. Nyalakan GPS dan izinkan lokasi untuk situs ini di pengaturan browser, lalu coba lagi.'}</p>
      <button onClick={getPos}>Coba lagi</button>
      <button className="ghost" onClick={keluarAkun}><Icon name="logout" size={18} /> Logout</button>
    </div>)

  const overlays = <>
    <FarDialog far={far} onClose={() => setFar(null)} />
    {stokOpen && <StokForm focusIds={ctx.focusIds} onClose={() => setStokOpen(false)} onSaved={() => { stokH.segarkan(); say('Stok tersimpan') }} />}
    {toast && <div className="toast" role="status"><Icon name="check" size={18} /> {toast}</div>}
  </>
  const barOffline = snap ? <OfflineBar onMuat={() => location.reload()} /> : null

  if (visit) return (
    <SellScreen visit={visit} tz={tz} anim={anim} produk={ctx.products} siap={ctx.siap} terakhir={ctx.last} fokus={ctx.focusIds} qty={qty} setQty={setQty}
      stok={stokH.stok} enforce={stokH.enforce} stokSiap={stokH.siap} sisaOf={stokH.sisaOf} minCo={ctx.minCo} busy={busy} err={err}
      onKeluar={keluar} onStok={() => setStokOpen(true)} atas={barOffline}>{overlays}</SellScreen>)

  return (
    <div className={`phone ${anim}`}>
      {struk && !prefOpen && <ReceiptDialog struk={struk} pref={pref} onClose={() => setStruk(null)} onDone={() => { setStruk(null); say('Struk selesai') }} onSettings={() => setPrefOpen(true)} />}
      {prefOpen && <PrinterSettings pref={pref} onChange={setPref} onClose={() => setPrefOpen(false)} onToast={say} />}
      {overlays}
      {tab === 'sell'
        ? <OutletList me={me} rayon={o.rayon} setRayon={o.setRayon} rows={o.rows} loading={o.loading} visited={o.visited} pos={pos} getPos={getPos}
            busy={busy} busyId={busyId} err={err} onMasuk={masuk} onReload={o.load} onToast={say} luring={!!snap}
            bar={<>{barOffline}<OutboxBar n={antrean.n} mengirim={antrean.mengirim} onKirim={antrean.kirim} /></>} />
        : <div className="ph-head">
            {tab === 'rekap' && <div className="hrow">
              <button className="back" aria-label={sel ? 'Kembali ke daftar tanggal' : 'Kembali ke Input'} onClick={backRekap}><Icon name="back" /></button>
              <h3 className="htitle">{sel ? 'Detail Harian' : 'Rekap'}</h3></div>}
            {tab === 'profile' && <div className="hrow"><h3 className="htitle">Profile</h3></div>}
          </div>}
      {tab === 'rekap' && <RekapTab rk={rk} sel={sel} sub={sub} tz={tz} onPick={x => { setSub('fwd'); setSel(x) }} />}
      {tab === 'profile' && <ProfileTab nama={me.nama} userId={me.user_id} stokSum={stokSum} onStok={() => setStokOpen(true)} onLogout={keluarAkun} onPrinter={() => setPrefOpen(true)}
        onReprint={() => { const s = muatTerakhir(); if (s) setStruk(s) }}
        printerInfo={`${pref.metode === 'bt' ? 'Bluetooth langsung' : pref.metode === 'rawbt' ? 'RawBT' : 'Dialog cetak sistem'} · ${pref.lebar === 32 ? '58' : '80'} mm`}
        strukInfo={terakhir ? `${terakhir.outlet} · ${terakhir.waktu}` : null} />}
      <div className="tabbar">
        <button className={tab === 'profile' ? 'on' : ''} onClick={() => setTab('profile')}><span className="pill"><Icon name="user" /></span>Profile</button>
        <button className={tab === 'sell' ? 'on' : ''} onClick={() => setTab('sell')}><span className="pill"><Icon name="basket" /></span>Input</button>
        <button className={tab === 'rekap' ? 'on' : ''} onClick={() => { setTab('rekap'); setSel('') }}><span className="pill"><Icon name="list" /></span>Rekap</button></div>
    </div>)
}
