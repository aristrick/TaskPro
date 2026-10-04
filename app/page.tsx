'use client'
import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import Shell from '../components/Shell'
import Icon from '../components/Icon'
import { SettingRow } from '../components/Switch'
import { useDialog } from '../components/Dialog'
import { supabase } from '../lib/supabase'
import { loadMe } from '../lib/auth'
import { rekap, day, rp, rpk, VSEL, fetchAll, startOfDay } from '../lib/rekap'
import { friendly } from '../lib/friendly'

type N = number | null
const hitung = async (t: string, f?: (q: any) => any): Promise<N> => {
  let q: any = supabase.from(t).select('id', { count: 'exact', head: true }); if (f) q = f(q)
  const { count, error } = await q; return error ? null : (count ?? 0)
}
const salam = () => { const j = Number(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' })); return j < 11 ? 'Selamat pagi' : j < 15 ? 'Selamat siang' : j < 18 ? 'Selamat sore' : 'Selamat malam' }
const Skel = ({ w = 96 }: { w?: number }) => <span className="skel kpiskel" style={{ width: w }} />

function Home() {
  const dlg = useDialog()
  const [me, setMe] = useState<any>(null)
  const [rk, setRk] = useState<any>(null)            // rekap bulan ini
  const [tren, setTren] = useState<any>(null)        // rekap 7 hari terakhir
  const [d, setD] = useState<Record<string, N>>({})
  const [radius, setRadius] = useState<boolean | null>(null)
  const [stok, setStok] = useState<boolean | null>(null)
  const [usage, setUsage] = useState<any>(null)
  const role: string = me?.role || ''
  const mdm = role === 'mdm'

  useEffect(() => {
    loadMe().then(({ me }) => setMe(me))
    supabase.from('settings').select('value').eq('key', 'radius_enforced').maybeSingle().then(({ data }) => setRadius(data ? data.value === true : true))
    supabase.from('settings').select('value').eq('key', 'stok_enforced').maybeSingle().then(({ data }) => setStok(data ? data.value === true : true))
    // Rekap dihitung di database (hanya hasil ringkas yang dikirim; hemat kuota egress paket gratis)
    const h = day(new Date()), [y, mo] = h.split('-').map(Number)
    const awal = `${h.slice(0, 8)}01T00:00:00+07:00`
    const akhir = `${mo === 12 ? y + 1 : y}-${String(mo === 12 ? 1 : mo + 1).padStart(2, '0')}-01T00:00:00+07:00`
    supabase.rpc('rekap_harian', { p_from: awal, p_to: akhir }).then(({ data, error }) => {
      if (!error && data) return setRk(data)
      // Cadangan jika migrasi 12 belum dijalankan: hitung di browser seperti sebelumnya
      fetchAll((a, b) => supabase.from('visits').select(VSEL).gte('checkin_at', awal).order('checkin_at').range(a, b)).then(v => setRk(rekap(v))).catch(() => setRk({}))
    })
    supabase.rpc('rekap_harian', { p_from: startOfDay('Asia/Jakarta', 6), p_to: startOfDay('Asia/Jakarta', -1) }).then(({ data }) => setTren(data || {}))
    ;(async () => {
      const [cabang, outlet, frontliner, project, tanpaKoordinat, berjalan, mencurigakan] = await Promise.all([
        hitung('cabang'), hitung('outlets'), hitung('profiles', q => q.eq('role', 'frontliner')), hitung('projects'),
        hitung('outlets', q => q.is('lat', null)), hitung('visits', q => q.is('checkout_at', null)),
        hitung('visits', q => q.eq('suspect', true).gte('checkin_at', startOfDay('Asia/Jakarta', 7)))])
      setD(x => ({ ...x, cabang, outlet, frontliner, project, tanpaKoordinat, berjalan, mencurigakan }))
      try {   // frontliner yang belum mengisi stok pembawaan hari ini
        const rows = await fetchAll((a, b) => supabase.rpc('stok_laporan', { p_from: h, p_to: h, p_cabang: null, p_frontliner: null }).range(a, b) as any)
        const sudah = new Set(rows.map((r: any) => r.frontliner_id)).size
        setD(x => ({ ...x, belumStok: frontliner == null ? null : Math.max(0, frontliner - sudah) }))
      } catch { setD(x => ({ ...x, belumStok: null })) }
    })()
  }, [])
  useEffect(() => { if (mdm) supabase.rpc('db_usage').then(({ data }) => setUsage(data)) }, [mdm])

  // Mematikan aturan memengaruhi semua frontliner, jadi dikonfirmasi dulu. Tampilan diperbarui langsung dan dikembalikan jika gagal.
  async function ubah(key: string, v: boolean, set: (x: boolean) => void, matikan: { title: string; message: ReactNode }) {
    if (!v && !(await dlg.confirm({ ...matikan, okText: 'Matikan', tone: 'danger' }))) return
    set(v)
    const { error } = await supabase.from('settings').update({ value: v }).eq('key', key)
    if (error) { set(!v); dlg.alert({ title: 'Gagal menyimpan', message: friendly(error), tone: 'danger', icon: 'close' }) }
  }

  const hr = day(new Date())
  const days = rk ? Object.values(rk) as any[] : []
  const hari = rk?.[hr]
  const bulan = days.reduce((a, x) => a + x.value, 0), ocB = days.reduce((a, x) => a + x.oc, 0), visB = days.reduce((a, x) => a + x.visits, 0)
  const avg = days.length > 1 ? bulan / days.length : 0
  const fokus: Record<string, { ec: number; qty: number }> = {}
  days.forEach(x => Object.entries(x.prod).forEach(([p, v]: any) => { if (v.focus) { const f = (fokus[p] ||= { ec: 0, qty: 0 }); f.ec += v.ec; f.qty += v.qty } }))
  const fokusList = Object.entries(fokus).sort((a, b) => b[1].qty - a[1].qty), maxQ = fokusList[0]?.[1].qty || 1
  const seri = Array.from({ length: 7 }, (_, i) => {
    const t = new Date(Date.now() - (6 - i) * 864e5), k = day(t)
    return { k, v: Number(tren?.[k]?.value || 0), today: i === 6, l: t.toLocaleDateString('id-ID', { weekday: 'short', timeZone: 'Asia/Jakarta' }) }
  })
  const maxV = Math.max(1, ...seri.map(x => x.v))
  const BATAS = Number(process.env.NEXT_PUBLIC_DB_LIMIT_MB || 500) * 1024 * 1024   // paket gratis Supabase: 500 MB (isi NEXT_PUBLIC_DB_LIMIT_MB jika paket naik)
  const pakai = usage ? Number(usage.bytes) / BATAS : 0
  const canSeeCabang = ['mdm', 'rmdm'].includes(role)

  const perhatian: { k: string; icon: string; n: N; label: string; href?: string; netral?: boolean }[] = [
    { k: 'sus', icon: 'alert', n: d.mencurigakan ?? null, label: 'Kunjungan mencurigakan (7 hari)', href: '/pantau' },
    { k: 'stok', icon: 'basket', n: d.belumStok ?? null, label: 'Frontliner belum mengisi stok hari ini', href: '/stok' },
    { k: 'koord', icon: 'pin', n: d.tanpaKoordinat ?? null, label: 'Outlet belum punya koordinat', href: '/outlet' },
    { k: 'jalan', icon: 'locate', n: d.berjalan ?? null, label: 'Kunjungan sedang berjalan', netral: true }]
  const aman = perhatian.filter(x => !x.netral).every(x => x.n === 0)
  const tiles: { k: string; icon: string; label: string; n: N | undefined; href?: string }[] = [
    { k: 'cabang', icon: 'building', label: 'Cabang', n: d.cabang, href: canSeeCabang ? '/cabang' : undefined },
    { k: 'outlet', icon: 'store', label: 'Outlet', n: d.outlet, href: '/outlet' },
    { k: 'fl', icon: 'users', label: 'Frontliner', n: d.frontliner, href: ['mdm', 'rmdm', 'mds'].includes(role) ? '/frontliner' : undefined },
    { k: 'pr', icon: 'folder', label: 'Project', n: d.project, href: ['mdm', 'rmdm', 'mds'].includes(role) ? '/project' : undefined }]

  const kpi = (icon: string, label: string, val: ReactNode, sub?: ReactNode, tone = '') =>
    <div className={`kpi2 ${tone}`}><span className="kico"><Icon name={icon} size={18} /></span><span className="label">{label}</span><b>{val}</b>{sub && <small>{sub}</small>}</div>

  return (<>
    <div className="homehead">
      <div><h2>Home</h2><p className="muted">{salam()}{me?.nama ? `, ${me.nama}` : ''} · {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })}</p></div>
    </div>

    <div className="home">
      <div className="col">
        <section className="o1">
          <h3 className="sech">Hari ini</h3>
          <div className="kpis2">
            {kpi('chart', 'Penjualan hari ini', rk ? rp(hari?.value || 0) : <Skel />, hari && avg > 0 ? <span className={hari.value >= avg ? 'up' : 'down'}><Icon name={hari.value >= avg ? 'up' : 'down'} size={14} /> {Math.abs(Math.round((hari.value / avg - 1) * 100))}% vs rata-rata harian</span> : undefined, 'main')}
            {kpi('store', 'OC hari ini', rk ? (hari?.oc || 0) : <Skel w={40} />, rk ? `dari ${hari?.visits || 0} kunjungan` : undefined)}
          </div>
          <h3 className="sech">Bulan ini</h3>
          <div className="kpis2">
            {kpi('chart', 'Penjualan bulan ini', rk ? rp(bulan) : <Skel />, rk && days.length ? `rata-rata ${rpk(bulan / days.length)} per hari` : undefined, 'main')}
            {kpi('store', 'OC bulan ini', rk ? ocB : <Skel w={40} />, rk ? `dari ${visB} kunjungan` : undefined)}
          </div>
        </section>

        <section className="card o3">
          <div className="sech-in"><h3>Penjualan 7 hari terakhir</h3><span className="muted">{rpk(seri.reduce((a, x) => a + x.v, 0))}</span></div>
          {tren === null ? <div className="skel" style={{ height: 150 }} /> :
            <div className="bars" role="img" aria-label={`Penjualan 7 hari terakhir: ${seri.map(x => `${x.l} ${rpk(x.v)}`).join(', ')}`}>
              {seri.map(x => <div className={`bar ${x.today ? 'today' : ''}`} key={x.k}><span className="bv">{x.v ? rpk(x.v) : '-'}</span>
                <div className="bt"><i style={{ height: `${x.v ? Math.max(6, (x.v / maxV) * 100) : 3}%` }} /></div><span className="bl">{x.l}</span></div>)}
            </div>}
        </section>

        <section className="card o4">
          <div className="sech-in"><h3>Produk fokus bulan ini</h3>{fokusList.length > 0 && <span className="muted">EC dan Qty</span>}</div>
          {rk === null ? <div className="skel" style={{ height: 80 }} /> : fokusList.length === 0
            ? <p className="muted" style={{ margin: 0 }}>Belum ada penjualan produk fokus. Atur produk fokus di halaman Project atau Produk.</p>
            : fokusList.map(([p, x]) => <div className="frow" key={p}>
                <div className="fhead"><span>{p}</span><span className="fnum"><b>EC {x.ec}</b><b>Qty {x.qty}</b></span></div>
                <div className="fbar" aria-hidden="true"><i style={{ width: `${(x.qty / maxQ) * 100}%` }} /></div></div>)}
        </section>
      </div>

      <div className="col">
        <section className="card o2">
          <div className="sech-in"><h3>Perlu perhatian</h3>{aman && d.mencurigakan !== undefined && <span className="on-badge">Semua aman</span>}</div>
          {perhatian.map(x => {
            const inner = <>
              <span className={`pico ${x.n ? (x.netral ? 'info' : 'warn') : ''}`}><Icon name={x.icon} size={18} /></span>
              <span className="plabel">{x.label}</span>
              {x.n === null ? <Skel w={28} /> : <b className={`pnum ${x.n && !x.netral ? 'warn' : ''}`}>{x.n}</b>}
              {x.href && <Icon name="chevron" size={16} />}</>
            return x.href ? <Link className="prow2" href={x.href} key={x.k}>{inner}</Link> : <div className="prow2 static" key={x.k}>{inner}</div>
          })}
        </section>

        <section className="card o5">
          <div className="sech-in"><h3>Ringkasan data</h3></div>
          <div className="tiles2">
            {tiles.map(t => {
              const inner = <><span className="kico"><Icon name={t.icon} size={18} /></span><b>{t.n === undefined || t.n === null ? <Skel w={36} /> : t.n.toLocaleString('id-ID')}</b><span className="label">{t.label}</span></>
              return t.href ? <Link className="tile2" href={t.href} key={t.k}>{inner}</Link> : <div className="tile2" key={t.k}>{inner}</div>
            })}
          </div>
        </section>

        <section className="card o6">
          <div className="sech-in"><h3>Pengaturan</h3></div>
          <SettingRow icon="locate" title="Wajib dekat outlet saat input penjualan" checked={radius} canEdit={mdm}
            desc={radius ? 'Aktif: check-in dan input penjualan hanya bisa maksimal 50 m dari outlet.' : 'Nonaktif: bisa input di mana saja.'}
            onChange={v => ubah('radius_enforced', v, setRadius, { title: 'Matikan aturan 50 meter?', message: 'Semua frontliner bisa check-in dan input penjualan dari mana saja, kecuali yang GPS-nya sudah dikecualikan.' })} />
          <SettingRow icon="basket" title="Batasi penjualan sesuai stok pembawaan" checked={stok} canEdit={mdm}
            desc={stok ? 'Aktif: frontliner harus mengisi stok pembawaan harian, dan penjualan tidak bisa melebihi stok yang dibawa hari itu.' : 'Nonaktif: penjualan tidak dibatasi stok.'}
            onChange={v => ubah('stok_enforced', v, setStok, { title: 'Matikan batas stok?', message: 'Penjualan tidak lagi dibatasi stok pembawaan. Frontliner bisa menjual berapa pun.' })} />
        </section>

        {mdm && <section className="card o7">
          <div className="sech-in"><h3>Penyimpanan database</h3>{usage && <span className="muted">{(pakai * 100).toFixed(0)}%</span>}</div>
          {!usage ? <div className="skel" style={{ height: 60 }} /> : <>
            <p className="muted" style={{ margin: '0 0 8px' }}>{(Number(usage.bytes) / 1048576).toFixed(1)} MB dari {(BATAS / 1048576).toFixed(0)} MB</p>
            <div className="meter" role="progressbar" aria-valuenow={Math.round(pakai * 100)} aria-valuemin={0} aria-valuemax={100}><i className={pakai >= .9 ? 'bad' : pakai >= .7 ? 'warn' : ''} style={{ width: `${Math.min(100, pakai * 100)}%` }} /></div>
            {pakai >= .7 && <p className={pakai >= .9 ? 'err' : 'muted'} style={{ margin: '8px 0 0' }}>{pakai >= .9 ? 'Hampir penuh: database bisa menjadi hanya-baca. ' : 'Mulai terisi. '}Ekspor lalu hapus data lama, atau naikkan paket Supabase.</p>}
            <div style={{ marginTop: 10 }}>{(usage.tabel || []).slice(0, 5).map((t: any) => <div className="line" key={t.nama}><span>{t.nama}</span><b>{(Number(t.bytes) / 1048576).toFixed(1)} MB</b></div>)}</div></>}
        </section>}
      </div>
    </div>
  </>)
}
export default function Page() { return <Shell roles={['mds', 'mdm', 'rmdm', 'tl', 'kormot']}><Home /></Shell> }
