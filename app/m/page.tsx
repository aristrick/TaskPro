'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { rekap, day, rp, VSEL } from '../../lib/rekap'
import OutletForm from '../../components/OutletForm'
import Icon from '../../components/Icon'

const R = 6371000, rad = (x: number) => (x * Math.PI) / 180
const meters = (a: number, b: number, c: number, d: number) => {
  const h = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
const fresh = () => new Promise<GeolocationPosition>((ok, no) => navigator.geolocation.getCurrentPosition(ok, no, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }))
const payload = (p: GeolocationPosition | null) => (p ? { p_lat: p.coords.latitude, p_lng: p.coords.longitude, p_acc: p.coords.accuracy } : { p_lat: null, p_lng: null, p_acc: null })
const fmt = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`)
const QUICK = [1, 2, 5, 10]
const buzz = (ms = 14) => { try { navigator.vibrate?.(ms) } catch {} }
const todayStart = () => `${day(new Date())}T00:00:00+07:00`

export default function Frontliner() {
  const router = useRouter()
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
  const say = (t: string) => { buzz(18); setTimeout(() => { setToast(t); setTimeout(() => setToast(''), 2200) }, 350) }
  const closeMenu = () => { setClosingMenu(true); setTimeout(() => { setMenu(false); setClosingMenu(false) }, 200) }

  const loadVisit = async (uid: string, a = '') => {
    const { data } = await supabase.from('visits').select('id,outlet_id,outlets(name,address,lat,long)').eq('frontliner_id', uid).is('checkout_at', null).maybeSingle()
    setAnim(a); setVisit(data)
  }
  function getPos() {
    if (!navigator.geolocation) return setGps('nogeo')
    setGps('wait')
    navigator.geolocation.getCurrentPosition(
      p => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setGps('ok') },
      () => setGps('denied'), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
  }
  const loadRows = () => { if (me) supabase.from('outlets').select('*').eq('kode_md', me.user_id).eq('rayon', rayon).eq('status', 'AKTIF').limit(1000).then(({ data }) => setRows(data || [])) }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return router.replace('/login')
      const { data: p } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
      if (!p) return router.replace('/login')
      if (p.role !== 'frontliner') return router.replace('/')
      setMe(p); loadVisit(p.id)
    })
    setRayon(+(localStorage.getItem('rayon') || 1)); getPos()
  }, [router])
  useEffect(loadRows, [me, rayon])
  useEffect(() => {
    if (me) supabase.from('visits').select('outlet_id').eq('frontliner_id', me.id).gte('checkin_at', todayStart())
      .then(({ data }) => setVisited(new Set((data || []).map((x: any) => x.outlet_id))))
  }, [me, visit])
  useEffect(() => {
    if (!visit) return
    supabase.from('products').select('*').eq('active', true).order('is_focus', { ascending: false }).order('product').then(({ data }) => setProducts(data || []))
    supabase.from('visits').select('sales(product_id,qty)').eq('outlet_id', visit.outlet_id).eq('frontliner_id', me.id).not('checkout_at', 'is', null)
      .order('checkin_at', { ascending: false }).limit(1).then(({ data }) => setLast(Object.fromEntries(((data?.[0] as any)?.sales || []).map((x: any) => [x.product_id, x.qty]))))
  }, [visit])
  useEffect(() => {
    if (tab !== 'rekap' || !me) return
    supabase.from('visits').select(VSEL).eq('frontliner_id', me.id).gte('checkin_at', `${day(new Date(Date.now() - 35 * 864e5))}T00:00:00+07:00`).limit(2000)
      .then(({ data }) => setRk(rekap(data || [])))
  }, [tab, me])

  // Frontliner yang dikecualikan MDM boleh tanpa GPS: posisi kosong dan server tidak menerapkan batas 50 m
  const geo = async () => { try { return await fresh() } catch (e) { if (me.gps_required === false) return null; throw e } }
  const jauh = (e: any, name: string, lat: any, long: any) => {
    const m = /Anda (\d+) m dari outlet/.exec(e?.message || ''); if (!m) return false
    setFar({ name, d: +m[1], lat, long }); return true
  }
  async function masuk(r: any) {
    if (!confirm(`Check-in di ${r.name}?`)) return
    setBusy(true); setErr('')
    try {
      const p = await geo(); if (p) setPos({ lat: p.coords.latitude, lng: p.coords.longitude })
      const { error } = await supabase.rpc('checkin', { p_outlet: r.id, ...payload(p) }); if (error) throw error
      setQty({}); await loadVisit(me.id, 'fwd'); buzz()
    } catch (e: any) { if (!jauh(e, r.name, r.lat, r.long)) setErr(e.message || 'Gagal membaca lokasi') }
    setBusy(false)
  }
  async function keluar() {
    setBusy(true); setErr('')
    try {
      const items = products.filter(x => qty[x.id] > 0).map(x => ({ product_id: x.id, qty: qty[x.id] }))
      if (items.length) { const p = await geo(); const { error } = await supabase.rpc('save_sales', { p_visit: visit.id, p_items: items, ...payload(p) }); if (error) throw error }
      const { error } = await supabase.rpc('checkout', { p_visit: visit.id }); if (error) throw error
      setAnim('back'); setVisit(null); setQty({}); say('Check-out berhasil')
    } catch (e: any) { if (!jauh(e, visit.outlets?.name, visit.outlets?.lat, visit.outlets?.long)) setErr(e.message || 'Gagal membaca lokasi') }
    setBusy(false)
  }
  const total = products.reduce((a, x) => a + (qty[x.id] || 0) * Number(x.price), 0)
  const items = products.filter(x => qty[x.id] > 0).length

  if (!me) return <p className="muted" style={{ padding: 24 }}>Memuat…</p>
  if (gps !== 'ok' && me.gps_required !== false) return (
    <div className="gate">
      <h2>Aktifkan Lokasi (GPS)</h2>
      <p className="muted">{gps === 'wait' ? 'Meminta izin lokasi…' : gps === 'nogeo' ? 'Perangkat ini tidak mendukung GPS.'
        : 'TaskPro butuh lokasi Anda untuk menghitung jarak ke outlet. Nyalakan GPS dan izinkan lokasi untuk situs ini di pengaturan browser, lalu coba lagi.'}</p>
      <button onClick={getPos}>Coba lagi</button>
      <button className="ghost" onClick={async () => { await supabase.auth.signOut(); router.replace('/login') }}><Icon name="logout" size={18} /> Logout</button>
    </div>)

  const farDialog = far && <div className="overlay" onClick={() => setFar(null)}><div className="dialog" role="alertdialog" onClick={e => e.stopPropagation()}>
    <div className="dicon"><Icon name="pin" size={28} /></div>
    <h3>Terlalu jauh dari outlet</h3>
    <p>Jarak Anda <b>{far.d >= 1000 ? (far.d / 1000).toFixed(1) + ' km' : far.d + ' m'}</b> dari <b>{far.name}</b>. Check-in dan input penjualan hanya bisa maksimal 50 m dari outlet.</p>
    <div className="dbtns"><button className="ghost" onClick={() => setFar(null)}>Cancel</button>
      {far.lat != null && <a className="btnlink" target="_blank" onClick={() => setFar(null)} href={`https://www.google.com/maps/dir/?api=1&destination=${far.lat},${far.long}`}><Icon name="nav" size={18} /> Menuju Outlet</a>}</div></div></div>

  if (visit) return (
    <div className={`phone dark ${anim}`}>
      {farDialog}
      <div className="hero"><span className="label">Kunjungan berjalan</span><h2>{visit.outlets?.name}</h2><div className="hint">{visit.outlets?.address}</div></div>
      <div className="sheet">
        <p className="notice">Penjualan baru tersimpan saat Check-out. Jika halaman ditutup, kunjungan tetap terbuka dan belum terhitung.</p>
        {Object.keys(last).length > 0 && <button className="ghost" style={{ marginBottom: 8 }} onClick={() => setQty(last)}><Icon name="refresh" size={16} /> Isi seperti kunjungan terakhir</button>}
        {products.map(x => <div className="prod" key={x.id}>
          <div className="row" style={{ margin: 0 }}><b>{x.product}</b>{x.is_focus && <span className="badge">FOKUS</span>}<div className="grow" /><span className="muted">{rp(Number(x.price))}</span></div>
          <div className="row" style={{ margin: '8px 0 0' }}>
            <button className="ghost step" aria-label="Kurangi" onClick={() => { buzz(8); setQty({ ...qty, [x.id]: Math.max(0, (qty[x.id] || 0) - 1) }) }}><Icon name="minus" size={18} /></button>
            <b key={qty[x.id] || 0} className="qty pop">{qty[x.id] || 0}</b>
            <button className="ghost step" aria-label="Tambah" onClick={() => { buzz(8); setQty({ ...qty, [x.id]: (qty[x.id] || 0) + 1 }) }}><Icon name="plus" size={18} /></button>
            <div className="grow" />{QUICK.map(n => <button key={n} className={`ghost quick ${qty[x.id] === n ? 'on' : ''}`} onClick={() => { buzz(8); setQty({ ...qty, [x.id]: n }) }}>{n}</button>)}
          </div></div>)}
        {err && <p className="err" role="alert">{err}</p>}
      </div>
      <div className="stickybar"><div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{items ? `${items} produk dipilih` : 'Belum ada penjualan'}</div>
        <button disabled={busy} style={{ width: '100%' }} onClick={keluar}>{busy ? 'Memproses…' : items ? `Check-out · ${rp(total)}` : 'Check-out tanpa penjualan'}</button></div>
    </div>)

  const list = rows
    .map(r => ({ ...r, d: r.lat == null || !pos ? null : meters(pos.lat, pos.lng, r.lat, r.long) }))
    .filter(r => !q.trim() || (r.name + ' ' + r.address).toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (a.d ?? 1e12) - (b.d ?? 1e12))
  const done = rows.filter(r => visited.has(r.id)).length
  const days = rk ? Object.keys(rk).sort().reverse() : []
  const dd = sel && rk?.[sel]
  const others = days.filter(x => x !== sel).map(x => rk[x].value).filter(v => v > 0)
  const avg = others.length ? others.reduce((a, b) => a + b, 0) / others.length : 0

  return (
    <div className={`phone ${anim}`}>
      {farDialog}
      {toast && <div className="toast" role="status"><Icon name="check" size={18} /> {toast}</div>}
      {form && <OutletForm me={me} rayon={rayon} pos={pos} outlet={form === 'new' ? null : form} onClose={() => setForm(null)} onSaved={() => { setForm(null); setEditMode(false); loadRows(); say('Outlet tersimpan') }} />}
      {menu && <div className={`drawer ${closingMenu ? 'out' : ''}`} onClick={closeMenu}><div onClick={e => e.stopPropagation()}>
        <h3>Menu</h3>
        <a onClick={() => { closeMenu(); setTab('sell'); setEditMode(true) }}><Icon name="edit" size={20} /> Edit Outlet</a>
        <a onClick={() => alert('TaskPro — aplikasi kunjungan dan penjualan Taskforce')}><Icon name="info" size={20} /> About</a></div></div>}
      <div className="ph-head">
        <div className="hrow">
          <button className="icon" aria-label="Menu" onClick={() => setMenu(true)}><Icon name="dots" /></button>
          <h3 className="htitle">{tab === 'sell' ? 'Input Selling' : tab === 'rekap' ? 'Rekap' : 'Profile'}</h3><div className="grow" />
          <button className="icon" aria-label="Refresh lokasi" onClick={() => { setSpin(true); setTimeout(() => setSpin(false), 700); getPos(); buzz(10) }}><Icon name="refresh" className={spin ? 'spin' : ''} /></button>
          <button className="icon" aria-label="Tambah outlet" onClick={() => setForm('new')}><Icon name="plus" /></button></div>
        {tab === 'sell' && <>
          <div className="hrow"><input placeholder="Cari outlet…" value={q} onChange={e => setQ(e.target.value)} style={{ flex: 1 }} />
            <select value={rayon} style={{ width: 92 }} onChange={e => { setRayon(+e.target.value); localStorage.setItem('rayon', e.target.value) }}>
              {Array.from({ length: 24 }, (_, i) => <option key={i} value={i + 1}>R{String(i + 1).padStart(2, '0')}</option>)}</select></div>
          <div className="progress" aria-label="Progres kunjungan"><div className="bar" style={{ width: rows.length ? `${(done / rows.length) * 100}%` : 0 }} /></div>
          <div className="hint">{done} dari {rows.length} outlet sudah dikunjungi hari ini</div></>}
      </div>
      {editMode && tab === 'sell' && <div className="notice row" style={{ margin: 0, borderRadius: 0 }}><span className="grow">Mode edit: pilih outlet yang ingin diubah.</span><button className="ghost" onClick={() => setEditMode(false)}>Selesai</button></div>}
      {err && tab === 'sell' && <p className="err" role="alert" style={{ padding: '8px 16px', margin: 0 }}>{err}</p>}
      {tab === 'sell' && (list.length === 0 ? <div className="empty"><b>Belum ada outlet di rayon R{String(rayon).padStart(2, '0')}</b><p className="muted">Pilih rayon lain, atau tambah outlet baru dengan tombol + di kanan atas.</p></div>
        : list.map((r, i) => <div className="item" style={{ ['--i' as any]: Math.min(i, 10) }} key={r.id} onClick={() => !busy && (editMode ? setForm(r) : masuk(r))}>
          <div className={`dist ${r.d != null && r.d <= 50 ? 'near' : ''}`}>{r.d == null ? '?' : fmt(r.d)}</div>
          <div className="grow"><b>{r.name}</b>{visited.has(r.id) && <span className="badge ok"><Icon name="check" size={12} /> SUDAH</span>}
            <div className="muted" style={{ fontSize: 13 }}>{r.address}</div>
            {r.lat == null && <div className="err" style={{ fontSize: 12 }}>lokasi outlet belum ada</div>}</div>
          {r.lat != null && <a className="go" aria-label="Menuju lokasi" target="_blank" onClick={e => e.stopPropagation()} href={`https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.long}`}><Icon name="nav" size={20} /></a>}
        </div>))}
      {tab === 'rekap' && (!rk ? <p className="muted" style={{ padding: 16 }}>Memuat…</p> : dd ? <div className={`slide ${sub}`} style={{ padding: 16 }}>
        <button className="ghost" onClick={() => { setSub('back'); setSel('') }}><Icon name="back" size={18} /> Semua tanggal</button>
        <h3 style={{ marginTop: 12 }}>{new Date(sel + 'T00:00:00+07:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta' })}</h3>
        <div className="kpis"><div className="kpi"><span className="label">Total</span><b>{rp(dd.value)}</b></div><div className="kpi"><span className="label">OC</span><b>{dd.oc}</b></div><div className="kpi"><span className="label">Kunjungan</span><b>{dd.visits}</b></div></div>
        {avg > 0 && dd.value > 0 && <p className="muted"><Icon name={dd.value >= avg ? 'up' : 'down'} size={16} /> {Math.abs(Math.round((dd.value / avg - 1) * 100))}% {dd.value >= avg ? 'di atas' : 'di bawah'} rata-rata harianmu ({rp(avg)})</p>}
        <span className="label">Produk fokus</span>
        {Object.entries(dd.prod).filter(([, p]: any) => p.focus).length === 0 ? <p className="muted">Belum ada penjualan produk fokus.</p>
          : Object.entries(dd.prod).filter(([, p]: any) => p.focus).map(([n, p]: any) => <div className="line" key={n}><span>{n}</span><b>EC {p.ec} · Qty {p.qty}</b></div>)}
        <span className="label" style={{ display: 'block', marginTop: 16 }}>Semua produk</span>
        {Object.entries(dd.prod).map(([n, p]: any) => <div className="line" key={n}><span>{n} × {p.qty}</span><b>{rp(p.value)}</b></div>)}
        <span className="label" style={{ display: 'block', marginTop: 16 }}>Outlet bertransaksi</span>
        {dd.outlets.map((o: any, i: number) => <div className="line" key={i}><span>{o.name}</span><b>{rp(o.value)}</b></div>)}
      </div> : days.length === 0 ? <div className="empty"><b>Belum ada kunjungan</b><p className="muted">Rekap muncul setelah Anda check-out di outlet pertama.</p></div>
        : days.map(x => <div className="item" key={x} onClick={() => { setSub('fwd'); setSel(x) }}><div className="grow"><b>{new Date(x + 'T00:00:00+07:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })}</b>
          <div className="muted" style={{ fontSize: 13 }}>{rk[x].oc} OC · {rk[x].visits} kunjungan</div></div><b>{rp(rk[x].value)}</b></div>))}
      {tab === 'profile' && <div className="profile fade">
        <div className="avatar" aria-hidden="true"><svg viewBox="0 0 120 120"><circle cx="60" cy="46" r="20" /><path d="M20 108c2-24 18-36 40-36s38 12 40 36z" /></svg></div>
        <h2 className="pname">{me.nama}</h2>
        <p className="pid">{me.user_id}</p>
        <button className="logout" onClick={async () => { await supabase.auth.signOut(); router.replace('/login') }}>LOG OUT</button></div>}
      <div className="tabbar">
        <button className={tab === 'profile' ? 'on' : ''} onClick={() => setTab('profile')}><span className="pill"><Icon name="user" /></span>Profile</button>
        <button className={tab === 'sell' ? 'on' : ''} onClick={() => setTab('sell')}><span className="pill"><Icon name="basket" /></span>Input</button>
        <button className={tab === 'rekap' ? 'on' : ''} onClick={() => { setTab('rekap'); setSel('') }}><span className="pill"><Icon name="list" /></span>Rekap</button></div>
    </div>)
}
