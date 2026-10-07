'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { loadMe } from '../../lib/auth'
import { logout, keluarLokal, useHeartbeat } from '../../lib/sesi'
import { useDialog } from '../../components/Dialog'
import { rekap, day, rp, VSEL, OFFSET, startOfDay } from '../../lib/rekap'
import { friendly } from '../../lib/friendly'
import OutletForm from '../../components/OutletForm'
import StokForm from '../../components/StokForm'
import RekapTab from '../../components/hp/RekapTab'
import ReceiptDialog from '../../components/ReceiptDialog'
import PrinterSettings from '../../components/PrinterSettings'
import { muatPref, prefBawaan, simpanTerakhir, muatTerakhir, type Pref } from '../../lib/printer'
import type { Struk } from '../../lib/escpos'
import ProfileTab from '../../components/hp/ProfileTab'
import { PageLoader, SkelRows } from '../../components/Loaders'
import Icon from '../../components/Icon'

import { meters, fresh, payload, fmt, buzz } from '../../lib/hp'

export default function Frontliner() {
  const router = useRouter(), dlg = useDialog()
  const [me, setMe] = useState<any>(null)
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null)
  const [gps, setGps] = useState<'wait' | 'ok' | 'denied' | 'nogeo'>('wait')
  const [rayon, setRayon] = useState(1)
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<any[]>([])
  const [tab, setTab] = useState<'sell' | 'rekap' | 'profile'>('sell')
  const [menu, setMenu] = useState(false)
  const [visit, setVisit] = useState<any>(null)
  const [products, setProducts] = useState<any[]>([])
  const [qty, setQty] = useState<Record<string, number>>({})
  const [last, setLast] = useState<Record<string, number>>({})
  const [visited, setVisited] = useState<Set<any>>(new Set())
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState<any>(null)
  const [rk, setRk] = useState<any>(null)
  const [sel, setSel] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [spin, setSpin] = useState(false)
  const [anim, setAnim] = useState('')
  const [sub, setSub] = useState('')
  const [closingMenu, setClosingMenu] = useState(false)
  const [far, setFar] = useState<any>(null)
  const [pq, setPq] = useState('')
  const [pf, setPf] = useState<'all' | 'focus' | 'sel'>('all')
  const [confirmOut, setConfirmOut] = useState(false)
  const [loadErr, setLoadErr] = useState('')
  const [focusIds, setFocusIds] = useState<Set<string>>(new Set())   // produk fokus project frontliner (satu project saja)
  const [rowsLoading, setRowsLoading] = useState(true)
  const [prodReady, setProdReady] = useState(false)
  const [busyId, setBusyId] = useState<any>(null)
  const [pref, setPref] = useState<Pref>(prefBawaan())          // pengaturan printer (tersimpan di perangkat)
  const [struk, setStruk] = useState<Struk | null>(null)           // struk yang sedang ditawarkan untuk dicetak
  const [terakhir, setTerakhir] = useState<Struk | null>(null)     // struk terakhir, untuk cetak ulang
  const [prefOpen, setPrefOpen] = useState(false)
  const [tz, setTz] = useState('Asia/Jakarta')   // zona waktu cabang frontliner (WIB/WITA/WIT)
  const [savedId, setSavedId] = useState<any>(null)
  // Stok pembawaan hari ini: penjualan tidak boleh melebihi stok yang dibawa (dijaga juga di database)
  const [stokOpen, setStokOpen] = useState(false)
  const [stok, setStok] = useState<Record<string, { dibawa: number; terjual: number }>>({})
  const [stokOn, setStokOn] = useState(true)          // saklar MDM di halaman Home
  const [stokMissing, setStokMissing] = useState(false) // migrasi 09 belum dijalankan: jangan memblokir
  const [stokReady, setStokReady] = useState(false)
  const [stokTick, setStokTick] = useState(0)
  const [draftId, setDraftId] = useState('')
  const enforce = stokOn && !stokMissing
  const sisaOf = (id: string) => (enforce ? Math.max(0, (stok[id]?.dibawa || 0) - (stok[id]?.terjual || 0)) : 9999)
  const draftKey = (id: string) => `taskpro-draft-${id}`
  useHeartbeat(!!me, async () => {
    await dlg.alert({ title: 'Sesi berakhir', icon: 'logout', message: 'Akun Anda keluar karena login di perangkat lain atau sesinya diakhiri admin.' })
    await keluarLokal(); router.replace('/login')
  })
  async function keluarAkun() {
    if (!(await dlg.confirm({ title: 'Keluar dari akun?', icon: 'logout', tone: 'danger', okText: 'Log out', message: 'Anda perlu login lagi untuk memakai TaskPro di perangkat ini.' }))) return
    await logout(); router.replace('/login')
  }
  const say = (t: string) => { buzz(18); setTimeout(() => { setToast(t); setTimeout(() => setToast(''), 2200) }, 350) }
  const closeMenu = () => { setClosingMenu(true); setTimeout(() => { setMenu(false); setClosingMenu(false) }, 200) }

  const loadVisit = async (uid: string, a = '') => {
    const { data } = await supabase.from('visits').select('id,outlet_id,checkin_at,project_id,outlets(name,address,lat,long)').eq('frontliner_id', uid).is('checkout_at', null).maybeSingle()
    setAnim(a); setVisit(data)
  }
  function getPos() {
    if (!navigator.geolocation) return setGps('nogeo')
    setGps('wait')
    navigator.geolocation.getCurrentPosition(
      p => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setGps('ok') },
      () => setGps('denied'), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
  }
  const loadRows = (keep?: boolean) => { if (me) { if (keep !== true) setRowsLoading(true); supabase.from('outlets').select('*').eq('kode_md', me.user_id).eq('rayon', rayon).eq('status', 'AKTIF').limit(1000).then(({ data }) => { setRows(data || []); setRowsLoading(false) }) } }

  useEffect(() => {
    loadMe().then(({ me: p, error }) => {
      if (error) return setLoadErr(error)
      if (!p) return router.replace('/login')
      if (p.role !== 'frontliner') return router.replace('/')
      setMe(p); loadVisit(p.id)
    })
    setRayon(+(localStorage.getItem('rayon') || 1)); getPos()
    try {   // buang draf penjualan yang sudah lebih dari 3 hari
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i)!
        if (k.startsWith('taskpro-draft-')) { const d = JSON.parse(localStorage.getItem(k) || '{}'); if (!d.t || Date.now() - d.t > 3 * 864e5) localStorage.removeItem(k) }
      }
    } catch {}
  }, [router])
  useEffect(loadRows, [me, rayon])
  useEffect(() => {
    if (me) supabase.from('visits').select('outlet_id').eq('frontliner_id', me.id).gte('checkin_at', startOfDay(tz))
      .then(({ data }) => setVisited(new Set((data || []).map((x: any) => x.outlet_id))))
  }, [me, visit, tz])
  useEffect(() => {
    if (!visit) return
    setProdReady(false)
    supabase.from('products').select('*').eq('active', true).order('product').then(({ data }) => { setProducts(data || []); setProdReady(true) })
    supabase.from('visits').select('sales(product_id,qty)').eq('outlet_id', visit.outlet_id).eq('frontliner_id', me.id).not('checkout_at', 'is', null)
      .order('checkin_at', { ascending: false }).limit(1).then(({ data }) => setLast(Object.fromEntries(((data?.[0] as any)?.sales || []).map((x: any) => [x.product_id, x.qty]))))
  }, [visit])
  useEffect(() => {
    if (tab !== 'rekap' || !me) return
    supabase.from('visits').select(VSEL).eq('frontliner_id', me.id).gte('checkin_at', startOfDay(tz, 35)).limit(2000)
      .then(({ data }) => setRk(rekap(data || [])))
  }, [tab, me, tz])

  // Produk fokus mengikuti project frontliner: saat kunjungan berjalan memakai project yang tercatat saat check-in
  useEffect(() => {
    if (!me) return
    let off = false
    ;(async () => {
      let pid = visit?.project_id
      if (!visit) { const { data } = await supabase.from('profiles').select('project_id').eq('id', me.id).maybeSingle(); pid = data?.project_id }
      if (!pid) { if (!off) setFocusIds(new Set()); return }
      const { data } = await supabase.from('project_focus').select('product_id').eq('project_id', pid)
      if (!off) setFocusIds(new Set((data || []).map((x: any) => x.product_id)))
    })()
    return () => { off = true }
  }, [me?.id, visit?.id])
  useEffect(() => { setPref(muatPref()); setTerakhir(muatTerakhir()) }, [])
  useEffect(() => { if (me?.cabang_id) supabase.from('cabang').select('tz').eq('id', me.cabang_id).maybeSingle().then(({ data }) => { if (data?.tz) setTz(data.tz) }) }, [me?.id])
  // Mode Edit Outlet: warna status bar ikut merah, dan mode otomatis berakhir jika pindah tab
  useEffect(() => { document.querySelector('meta[name="theme-color"]')?.setAttribute('content', editMode && tab === 'sell' ? '#B3261E' : '#0B1F4B') }, [editMode, tab])
  useEffect(() => { if (tab !== 'sell') setEditMode(false) }, [tab])
  // Draf penjualan: tersimpan otomatis per kunjungan, pulih saat halaman dimuat ulang, dihapus setelah check-out
  useEffect(() => {
    if (!visit) { setDraftId(''); return }
    try { const d = JSON.parse(localStorage.getItem(draftKey(visit.id)) || 'null'); if (d?.qty) setQty(d.qty) } catch {}
    setDraftId(visit.id)
  }, [visit?.id])
  useEffect(() => {
    if (!visit || draftId !== visit.id) return
    try {
      if (Object.values(qty).some(v => v > 0)) localStorage.setItem(draftKey(visit.id), JSON.stringify({ qty, t: Date.now() }))
      else localStorage.removeItem(draftKey(visit.id))
    } catch {}
  }, [qty, draftId, visit?.id])
  // Stok hari ini (di layar penjualan tidak menghitung penjualan kunjungan yang sedang berjalan)
  useEffect(() => {
    if (!me) return
    let off = false; setStokReady(false)
    supabase.rpc('stok_hari_ini', visit ? { p_exclude: visit.id } : {}).then(({ data, error }) => {
      if (off) return
      if (error) setStokMissing(true)
      setStok(Object.fromEntries((data || []).map((x: any) => [x.product_id, { dibawa: x.dibawa, terjual: x.terjual }]))); setStokReady(true)
    })
    return () => { off = true }
  }, [me, visit?.id, stokTick])
  useEffect(() => { if (me) supabase.from('settings').select('value').eq('key', 'stok_enforced').maybeSingle().then(({ data }) => setStokOn(data ? data.value === true : true)) }, [me])
  // Draf lama yang melebihi stok saat ini dipangkas
  useEffect(() => {
    if (!enforce || !stokReady) return
    setQty(q => { let c = false; const n = { ...q }; for (const id in n) { const s = sisaOf(id); if (n[id] > s) { n[id] = s; c = true } if (n[id] <= 0) { delete n[id]; c = true } } return c ? n : q })
  }, [stok, stokReady, enforce])

  // Frontliner yang dikecualikan MDM boleh tanpa GPS: posisi kosong dan server tidak menerapkan batas 50 m
  const geo = async () => { try { return await fresh() } catch (e) { if (me.gps_required === false) return null; throw e } }
  const jauh = (e: any, name: string, lat: any, long: any) => {
    const m = /Anda (\d+) m dari outlet/.exec(e?.message || ''); if (!m) return false
    setFar({ name, d: +m[1], lat, long }); return true
  }
  async function masuk(r: any) {
    if (!(await dlg.confirm({ title: 'Check-in di outlet ini?', icon: 'pin', okText: 'Check-in', message: <>Mulai kunjungan di <b>{r.name}</b>.</> }))) return
    setBusy(true); setBusyId(r.id); setErr('')
    try {
      const p = await geo(); if (p) setPos({ lat: p.coords.latitude, lng: p.coords.longitude })
      const { error } = await supabase.rpc('checkin', { p_outlet: r.id, ...payload(p) }); if (error) throw error
      setQty({}); setPq(''); setPf('all'); await loadVisit(me.id, 'fwd'); buzz()
    } catch (e: any) { if (!jauh(e, r.name, r.lat, r.long)) setErr(friendly(e, 'Gagal membaca lokasi')) }
    setBusy(false); setBusyId(null)
  }
  async function keluar() {
    // Struk disusun sekarang, selagi daftar produk dan jumlahnya masih ada (keadaan direset setelah check-out)
    const rinci = products.filter(x => qty[x.id] > 0)
    const baru: Struk | null = rinci.length ? { judul: pref.judul, footer: pref.footer, nomor: String(visit.id).slice(0, 8).toUpperCase(),
      waktu: new Date().toLocaleString('id-ID', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      outlet: visit.outlets?.name || '', alamat: visit.outlets?.address || '', frontliner: me.nama, userId: me.user_id,
      items: rinci.map(x => ({ nama: x.product, qty: qty[x.id], harga: Number(x.price) })), total: rinci.reduce((a, x) => a + qty[x.id] * Number(x.price), 0) } : null
    setBusy(true); setErr('')
    try {
      const items = products.filter(x => qty[x.id] > 0).map(x => ({ product_id: x.id, qty: qty[x.id] }))
      if (items.length) { const p = await geo(); const { error } = await supabase.rpc('save_sales', { p_visit: visit.id, p_items: items, ...payload(p) }); if (error) throw error }
      const { error } = await supabase.rpc('checkout', { p_visit: visit.id }); if (error) throw error
      try { localStorage.removeItem(draftKey(visit.id)) } catch {}
      if (baru) { simpanTerakhir(baru); setTerakhir(baru); if (pref.tanya) setStruk(baru) }
      setAnim('back'); setVisit(null); setQty({}); say('Check-out berhasil')
    } catch (e: any) { if (!jauh(e, visit.outlets?.name, visit.outlets?.lat, visit.outlets?.long)) setErr(friendly(e, 'Gagal membaca lokasi')) }
    setBusy(false)
  }
  const total = products.reduce((a, x) => a + (qty[x.id] || 0) * Number(x.price), 0)
  const items = products.filter(x => qty[x.id] > 0).length
  const pcs = products.reduce((a, x) => a + (qty[x.id] || 0), 0)

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

  const farDialog = far && <div className="overlay" onClick={() => setFar(null)}><div className="dialog" role="alertdialog" onClick={e => e.stopPropagation()}>
    <div className="dicon"><Icon name="pin" size={28} /></div>
    <h3>Terlalu jauh dari outlet</h3>
    <p>Jarak Anda <b>{far.d >= 1000 ? (far.d / 1000).toFixed(1) + ' km' : far.d + ' m'}</b> dari <b>{far.name}</b>. Check-in dan input penjualan hanya bisa maksimal 50 m dari outlet.</p>
    <div className="dbtns"><button className="ghost" onClick={() => setFar(null)}>Cancel</button>
      {far.lat != null && <a className="btnlink" target="_blank" onClick={() => setFar(null)} href={`https://www.google.com/maps/dir/?api=1&destination=${far.lat},${far.long}`}><Icon name="nav" size={18} /> Menuju Outlet</a>}</div></div></div>

  const stokModal = stokOpen && <StokForm focusIds={focusIds} onClose={() => setStokOpen(false)} onSaved={() => { setStokTick(t => t + 1); say('Stok tersimpan') }} />

  // ---------- Layar input penjualan ----------
  const ch = (id: string, v: number) => { buzz(8); setQty(q => ({ ...q, [id]: Math.max(0, Math.min(9999, sisaOf(id), Math.round(v) || 0)) })) }
  const totalSisa = products.reduce((a, x) => a + sisaOf(x.id) * (enforce ? 1 : 0), 0)
  const noStock = enforce && stokReady && products.length > 0 && totalSisa === 0
  const inTime = visit?.checkin_at ? new Date(visit.checkin_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: tz }) : ''
  const nFocus = products.filter(x => focusIds.has(x.id)).length
  const shown = products.filter(x => (!pq.trim() || (x.product + ' ' + (x.brand || '')).toLowerCase().includes(pq.trim().toLowerCase()))
    && (pf === 'all' || (pf === 'focus' ? focusIds.has(x.id) : qty[x.id] > 0)))
  const focusRows = shown.filter(x => focusIds.has(x.id)), otherRows = shown.filter(x => !focusIds.has(x.id))
  const prodRow = (x: any) => {
    const n = qty[x.id] || 0, price = Number(x.price), s = sisaOf(x.id), lim = enforce && stokReady
    return (
      <div key={x.id} className={`prow ${n > 0 ? 'on' : ''}`} onClick={() => n === 0 && (!lim || s > 0) && ch(x.id, 1)}>
        <div><div className="pname2">{x.product}{focusIds.has(x.id) && <span className="badge">FOKUS</span>}</div>
          <div className="pmeta">{[x.brand, rp(price)].filter(Boolean).join(' · ')}{lim && <span className={`stk ${s === 0 ? 'zero' : s <= 5 ? 'low' : ''}`}> · Sisa {s}</span>}</div></div>
        {n === 0
          ? <button className="addbtn" disabled={lim && s === 0} aria-label={`Tambah ${x.product}`} onClick={e => { e.stopPropagation(); ch(x.id, 1) }}><Icon name="plus" size={20} /></button>
          : <div className="stepper" onClick={e => e.stopPropagation()}>
              <button aria-label="Kurangi" onClick={() => ch(x.id, n - 1)}><Icon name="minus" size={18} /></button>
              <input inputMode="numeric" aria-label={`Jumlah ${x.product}`} value={n} onFocus={e => e.target.select()}
                onChange={e => { const v = e.target.value.replace(/\D/g, ''); ch(x.id, v === '' ? 1 : +v) }} />
              <button aria-label="Tambah" disabled={lim && n >= s} onClick={() => ch(x.id, n + 1)}><Icon name="plus" size={18} /></button></div>}
        {n > 0 && <div className="psub"><span>{n} × {rp(price)}{lim && n >= s && <span className="stk zero"> · sesuai sisa stok</span>}</span><b key={n} className="pop">{rp(n * price)}</b></div>}
      </div>)
  }

  if (visit) return (
    <div className={`phone dark ${anim}`}>
      {farDialog}
      {stokModal}
      {toast && <div className="toast" role="status"><Icon name="check" size={18} /> {toast}</div>}
      {confirmOut && <div className="overlay" onClick={() => setConfirmOut(false)}><div className="dialog left" role="dialog" onClick={e => e.stopPropagation()}>
        <h3>{items ? 'Simpan penjualan & check-out?' : 'Check-out tanpa penjualan?'}</h3>
        {items ? <div className="sumlist">
            {products.filter(x => qty[x.id] > 0).map(x => <div className="line" key={x.id}><span>{qty[x.id]} × {x.product}</span><b>{rp(qty[x.id] * Number(x.price))}</b></div>)}
            <div className="line tot"><span>Total</span><b>{rp(total)}</b></div></div>
          : <p>Belum ada produk yang diisi. Kunjungan akan dicatat tanpa penjualan (bukan Effective Call).</p>}
        <div className="dbtns"><button className="ghost" onClick={() => setConfirmOut(false)}>Kembali</button>
          <button disabled={busy} onClick={() => { setConfirmOut(false); keluar() }}>{items ? 'Simpan & Check-out' : 'Check-out'}</button></div></div></div>}
      <div className="hero compact"><span className="label">Kunjungan berjalan · sejak {inTime}</span><h2>{visit.outlets?.name}</h2><div className="hint">{visit.outlets?.address}</div></div>
      <div className="sheet">
        {noStock && <div className="notice warn row"><span className="grow">{Object.values(stok).some(x => x.dibawa > 0) ? 'Stok pembawaan hari ini sudah habis terjual.' : 'Belum ada stok pembawaan hari ini. Tambahkan dulu agar penjualan bisa diinput.'}</span>
          <button className="ghost small" onClick={() => setStokOpen(true)}>Tambahkan stok</button></div>}
        <div className="shead">
          <div className="searchbox"><Icon name="search" size={18} /><input placeholder="Cari produk…" aria-label="Cari produk" value={pq} onChange={e => setPq(e.target.value)} /></div>
          <div className="seg" role="tablist">
            {([['all', `Semua ${products.length}`], ['focus', `Fokus ${nFocus}`], ['sel', `Terpilih ${items}`]] as const).map(([k, t]) =>
              <button key={k} role="tab" aria-selected={pf === k} className={pf === k ? 'on' : ''} onClick={() => setPf(k)}>{t}</button>)}</div>
          {Object.keys(last).length > 0 && <button className="ghost small" onClick={() => setQty(last)}><Icon name="refresh" size={16} /> Isi seperti kunjungan terakhir</button>}
        </div>
        {!prodReady && <SkelRows n={6} />}
        {prodReady && shown.length === 0 && <div className="empty"><b>{pf === 'sel' && !pq ? 'Belum ada produk dipilih' : 'Produk tidak ditemukan'}</b>
          <p className="muted">{pf === 'sel' && !pq ? 'Ketuk tombol ＋ pada produk untuk menambahkannya.' : 'Coba kata kunci lain atau pilih tab Semua.'}</p></div>}
        {focusRows.length > 0 && <><span className="label sec">Produk fokus</span>{focusRows.map(prodRow)}</>}
        {otherRows.length > 0 && <>{focusRows.length > 0 && <span className="label sec">Produk lain</span>}{otherRows.map(prodRow)}</>}
        {err && <p className="err" role="alert">{err}</p>}
      </div>
      <div className="stickybar sumbar">
        <div className="sumtxt">{items ? <><span className="muted">{items} produk · {pcs} pcs</span><b>{rp(total)}</b></> : <span className="muted">Belum ada penjualan</span>}</div>
        <button disabled={busy} aria-busy={busy} onClick={() => setConfirmOut(true)}>{busy ? 'Memproses…' : 'Check-out'}</button>
      </div>
    </div>)

  const list = rows
    .map(r => ({ ...r, d: r.lat == null || !pos ? null : meters(pos.lat, pos.lng, r.lat, r.long) }))
    .filter(r => !q.trim() || (r.name + ' ' + r.address).toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (a.d ?? 1e12) - (b.d ?? 1e12))
  const done = rows.filter(r => visited.has(r.id)).length
  const stokSum = Object.values(stok).reduce((a, x) => (x.dibawa > 0 ? { n: a.n + 1, pcs: a.pcs + x.dibawa, sisa: a.sisa + x.dibawa - x.terjual } : a), { n: 0, pcs: 0, sisa: 0 })
  const backRekap = () => { if (sel) { setSub('back'); setSel('') } else { setSub(''); setTab('sell') } }

  return (
    <div className={`phone ${anim}`}>
      {struk && <ReceiptDialog struk={struk} pref={pref} onClose={() => setStruk(null)} onDone={() => { setStruk(null); say('Struk dicetak') }} onSettings={() => { setStruk(null); setPrefOpen(true) }} />}
      {prefOpen && <PrinterSettings pref={pref} onChange={setPref} onClose={() => setPrefOpen(false)} onToast={say} />}
      {farDialog}
      {stokModal}
      {toast && <div className="toast" role="status"><Icon name="check" size={18} /> {toast}</div>}
      {form && <OutletForm me={me} rayon={rayon} pos={pos} outlet={form === 'new' ? null : form} onClose={() => setForm(null)} onSaved={() => { const id = form !== 'new' ? form?.id : null; setForm(null); loadRows(true); say('Outlet tersimpan'); if (id) { setSavedId(id); setTimeout(() => setSavedId(null), 2000) } }}
        onDeleted={(r: string) => { setForm(null); setEditMode(false); loadRows(); say(r === 'deleted' ? 'Outlet dihapus' : 'Outlet dinonaktifkan') }} />}
      {menu && <div className={`drawer ${closingMenu ? 'out' : ''}`} onClick={closeMenu}><div onClick={e => e.stopPropagation()}>
        <h3>Menu</h3>
        <a onClick={() => { closeMenu(); setTab('sell'); setEditMode(true); buzz(25) }}><Icon name="edit" size={20} /> Edit Outlet</a>
        <a onClick={() => { closeMenu(); dlg.alert({ title: 'TaskPro', message: 'Aplikasi kunjungan dan penjualan Taskforce.' }) }}><Icon name="info" size={20} /> About</a></div></div>}
      <div className={`ph-head ${editMode && tab === 'sell' ? 'editing' : ''}`}>
        {tab === 'sell' && <div className="hrow">
          <button className="icon" aria-label="Menu" onClick={() => setMenu(true)}><Icon name="dots" /></button>
          <h3 className="htitle">{editMode ? 'Mode Edit Outlet' : 'Input Selling'}</h3><div className="grow" />
          {editMode
            ? <button className="donebtn" onClick={() => setEditMode(false)}><Icon name="check" size={18} /> Selesai</button>
            : <>          <button className="icon" aria-label="Refresh lokasi" onClick={() => { setSpin(true); setTimeout(() => setSpin(false), 700); getPos(); buzz(10) }}><Icon name="refresh" className={spin ? 'spin' : ''} /></button>
          <button className="icon" aria-label="Tambah outlet" onClick={() => setForm('new')}><Icon name="plus" /></button></>}</div>}
        {tab === 'rekap' && <div className="hrow">
          <button className="back" aria-label={sel ? 'Kembali ke daftar tanggal' : 'Kembali ke Input'} onClick={backRekap}><Icon name="back" /></button>
          <h3 className="htitle">{sel ? 'Detail Harian' : 'Rekap'}</h3></div>}
        {tab === 'profile' && <div className="hrow"><h3 className="htitle">Profile</h3></div>}
        {tab === 'sell' && <>
          <div className="hrow"><input placeholder="Cari outlet…" value={q} onChange={e => setQ(e.target.value)} style={{ flex: 1 }} />
            <select value={rayon} style={{ width: 92 }} onChange={e => { setRayon(+e.target.value); localStorage.setItem('rayon', e.target.value) }}>
              {Array.from({ length: 24 }, (_, i) => <option key={i} value={i + 1}>R{String(i + 1).padStart(2, '0')}</option>)}</select></div>
          {!editMode && <div className="progress" aria-label="Progres kunjungan"><div className="bar" style={{ width: rows.length ? `${(done / rows.length) * 100}%` : 0 }} /></div>}
          <div className="hint">{editMode ? 'Ketuk outlet yang ingin diubah. Check-in dinonaktifkan sampai Anda menekan Selesai.' : `${done} dari ${rows.length} outlet sudah dikunjungi hari ini`}</div></>}
      </div>
      {err && tab === 'sell' && <p className="err" role="alert" style={{ padding: '8px 16px', margin: 0 }}>{err}</p>}
      {tab === 'sell' && (rowsLoading ? <SkelRows n={6} /> : list.length === 0 ? <div className="empty"><b>Belum ada outlet di rayon R{String(rayon).padStart(2, '0')}</b><p className="muted">Pilih rayon lain, atau tambah outlet baru dengan tombol + di kanan atas.</p></div>
        : list.map((r, i) => <div className={`item ${r.lat == null ? 'nolat-row' : ''} ${savedId === r.id ? 'flash' : ''}`} style={{ ['--i' as any]: Math.min(i, 10) }} key={r.id} onClick={() => !busy && (editMode ? setForm(r) : masuk(r))}>
          <div className={`dist ${r.lat == null ? 'nolat' : r.d != null && r.d <= 50 ? 'near' : ''}`} title={r.lat == null ? 'Lokasi outlet belum ada' : undefined}>{busyId === r.id ? <span className="spinner" /> : r.lat == null ? <Icon name="alert" size={24} /> : r.d == null ? '?' : fmt(r.d)}</div>
          <div className="grow"><b>{r.name}</b>{visited.has(r.id) && <span className="badge ok"><Icon name="check" size={12} /> SUDAH</span>}
            <div className="muted" style={{ fontSize: 13 }}>{r.address}</div>
            {r.lat == null && <div className="nolat-msg"><Icon name="alert" size={14} /> Lokasi outlet belum ada</div>}</div>
          {r.lat != null && <a className="go" aria-label="Menuju lokasi" target="_blank" onClick={e => e.stopPropagation()} href={`https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.long}`}><Icon name="nav" size={20} /></a>}
        </div>))}
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
