'use client'
import { useEffect, useState } from 'react'
import Shell from '../../components/Shell'
import { supabase } from '../../lib/supabase'
import Icon from '../../components/Icon'
import { day, jam, hari, dt, dur, fetchAll } from '../../lib/rekap'

const SEL = 'id,checkin_at,checkout_at,effective,project:projects(name),outlets(ext_id,code,name,address,province_name,city_name,district,village,category,account,created_at),fl:profiles(user_id,nama,atasan_id,project:projects(name)),cabang(nama),sales(qty,price,value,products(product,sku_code,brand,category_product))'
const up = (s: any) => (s ? String(s).toUpperCase() : '')

function Report() {
  const [fl, setFl] = useState<any[]>([])
  const [sel, setSel] = useState('')
  const [cab, setCab] = useState('')
  const [cabs, setCabs] = useState<any[]>([])
  const [role, setRole] = useState('')
  const [from, setFrom] = useState(() => day(new Date()).slice(0, 8) + '01')
  const [to, setTo] = useState(() => day(new Date()))
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false)
  useEffect(() => {
    supabase.from('profiles').select('id,user_id,nama,cabang_id').eq('role', 'frontliner').order('user_id').then(({ data }) => setFl(data || []))
    supabase.from('cabang').select('id,kode,nama').order('kode').then(({ data }) => setCabs(data || []))
    supabase.auth.getUser().then(async ({ data }) => { const { data: p } = await supabase.from('profiles').select('role').eq('id', data.user!.id).single(); setRole(p?.role || '') })
  }, [])
  const multi = ['mdm', 'rmdm'].includes(role)   // MDM/RMDM boleh memilih cabang; kosong = semua cabang dalam wewenangnya

  async function unduh(jenis: 'kunjungan' | 'selling') {
    if (!from || !to || from > to) return setMsg('Rentang tanggal tidak valid.')
    if ((+new Date(to) - +new Date(from)) / 864e5 > 92) return setMsg('Maksimal rentang 92 hari.')
    setBusy(true); setMsg('Mengambil data…')
    try {
      const start = `${from}T00:00:00+07:00`, end = `${to}T23:59:59.999+07:00`
      const vs = await fetchAll((a, b) => { let q = supabase.from('visits').select(SEL).gte('checkin_at', start).lte('checkin_at', end).order('checkin_at').range(a, b); if (sel) q = q.eq('frontliner_id', sel); if (cab) q = q.eq('cabang_id', cab); return q })
      const ids = [...new Set(vs.map(v => v.fl?.atasan_id).filter(Boolean))]
      const { data: at } = ids.length ? await supabase.from('profiles').select('id,user_id,nama').in('id', ids) : { data: [] as any[] }
      const atasan = Object.fromEntries((at || []).map(x => [x.id, x]))
      const rows: any[] = []
      for (const v of vs) {
        const o = v.outlets || {}, a = atasan[v.fl?.atasan_id] || {}, area = up(v.cabang?.nama), ci = v.checkin_at, co = v.checkout_at
        const proj = v.project?.name || v.fl?.project?.name || `TASKFORCE BEVERAGE ${area}`   // nama dari halaman Project
        if (jenis === 'kunjungan') rows.push({ 'Checkin Date': day(ci), 'Checkin Time': jam(ci), 'Checkin Day': hari(ci), 'Checkout Date': co ? day(co) : '', 'Checkout Time': co ? jam(co) : '',
          Project: proj, 'ID Teamleader': a.user_id || '', 'Teamleader Name': a.nama || '', 'ID Frontliner': v.fl?.user_id, 'Frontliner Name': v.fl?.nama, Position: 'TF', Area: area,
          'Oultet ID': o.ext_id || '', 'Oultet Code': o.code, 'Oulte Name': o.name, 'Oulte Address': o.address, Province: up(o.province_name), City: up(o.city_name), District: up(o.district), Village: up(o.village),
          Category: o.category || '', Account: o.account || '', Duration: dur(ci, co), 'Effective Call': v.effective ? 'Yes' : 'No', 'Dashboard Checkout': '',
          'Outlet Created at': o.created_at ? dt(o.created_at) : '', Penjualan: v.sales.reduce((s: number, x: any) => s + Number(x.value), 0) || '' })
        else for (const s of v.sales) { const p = s.products || {}
          rows.push({ 'Checkin Date': day(ci), 'Checkin Time': jam(ci), 'Checkin Day': hari(ci), 'Checkout Date': co ? day(co) : '', 'Checkout Time': co ? jam(co) : '', Duration: dur(ci, co),
            Project: proj, 'ID Teamleader': a.user_id || '', 'Teamleader Name': a.nama || '', 'ID Frontliner': v.fl?.user_id, 'Frontliner Name': v.fl?.nama, Position: 'TF', Area: area,
            'Oultet ID': o.ext_id || '', 'Oultet Code': o.code, 'Oulte Name': o.name, 'Oulte Address': o.address, Province: up(o.province_name), City: up(o.city_name), District: up(o.district), Village: up(o.village),
            Category: o.category || '', Account: o.account || '', 'SKU Code': p.sku_code || '', Product: p.product, Description: `${String(p.product).replace(/ /g, '-')}-${p.product}`, Brand: p.brand || '',
            'Category Product': p.category_product || '', Price: Number(s.price), 'Total (Pcs)': s.qty, Value: Number(s.value), Images: '' }) }
      }
      if (!rows.length) { setBusy(false); return setMsg('Tidak ada data pada rentang ini.') }
      const XLSX = await import('xlsx'); const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), jenis === 'kunjungan' ? 'CHECKIN' : 'SELLING')
      XLSX.writeFile(wb, `${jenis === 'kunjungan' ? 'CHECKIN_KUNJUNGAN' : 'SELLING_PENJUALAN'}${cab ? '_' + cabs.find(c => c.id === cab)?.kode : ''}_${from}_${to}.xlsx`)
      setMsg(`Selesai: ${rows.length} baris diunduh.`)
    } catch (e: any) { setMsg(e.message || 'Gagal mengambil data') }
    setBusy(false)
  }
  return (<>
    <h2>Report</h2>
    <div className="card">
      <div className="row">
        {multi && <label className="fld"><span className="label">Cabang</span>
          <select value={cab} onChange={e => { setCab(e.target.value); setSel('') }}><option value="">Semua cabang</option>{cabs.map(c => <option key={c.id} value={c.id}>{c.kode} · {c.nama}</option>)}</select></label>}
        <label className="fld"><span className="label">Dari tanggal</span><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label className="fld"><span className="label">Sampai tanggal</span><input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
        <label className="fld"><span className="label">Frontliner</span>
          <select value={sel} onChange={e => setSel(e.target.value)}><option value="">Semua frontliner</option>{fl.filter(x => !cab || x.cabang_id === cab).map(x => <option key={x.id} value={x.id}>{x.user_id} · {x.nama}</option>)}</select></label>
      </div>
      <div className="row" style={{ margin: 0 }}>
        <button disabled={busy} aria-busy={busy} onClick={() => unduh('kunjungan')}><Icon name="download" size={18} /> Download Kunjungan (Check-in)</button>
        <button disabled={busy} aria-busy={busy} onClick={() => unduh('selling')}><Icon name="download" size={18} /> Download Selling (Penjualan)</button></div>
      {msg && <p className={msg.startsWith('Selesai') || msg.endsWith('…') ? 'muted' : 'err'} role="status">{msg}</p>}
    </div>
    <p className="muted">Kolom mengikuti contoh file CHECKIN dan SELLING. Waktu memakai zona WIB. Rentang tanggal wajib. Cabang dan frontliner yang dikosongkan berarti semua. Kolom Project berisi nama dari halaman Project.</p>
  </>)
}
export default function Page() { return <Shell roles={['mds', 'mdm', 'rmdm', 'tl', 'kormot']}><Report /></Shell> }
