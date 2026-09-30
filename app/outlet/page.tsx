'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Shell from '../../components/Shell'
import { supabase } from '../../lib/supabase'
import Icon from '../../components/Icon'
import { fetchAll, dt, day } from '../../lib/rekap'

const PAGE = 50
function Outlet() {
  const [cabang, setCabang] = useState<any[]>([])
  const [kmd, setKmd] = useState(''); const [kmds, setKmds] = useState<string[]>([])
  const [cid, setCid] = useState(''); const [q, setQ] = useState(''); const [rayon, setRayon] = useState(''); const [page, setPage] = useState(0)
  const [rows, setRows] = useState<any[]>([]); const [total, setTotal] = useState(0)
  const [ed, setEd] = useState<any>(null); const [err, setErr] = useState('')
  useEffect(() => { supabase.rpc('kode_md_list').then(({ data }) => setKmds((data as string[]) || [])) }, [])
  useEffect(() => { supabase.from('cabang').select('id,kode,nama').order('kode').then(({ data }) => setCabang(data || [])) }, [])
  const filt = (s: any) => {
    if (cid) s = s.eq('cabang_id', cid)
    if (rayon) s = s.eq('rayon', +rayon)
    if (kmd) s = s.eq('kode_md', kmd)
    const t = q.replace(/[,()%]/g, ' ').trim()
    if (t) s = s.or(`name.ilike.%${t}%,code.ilike.%${t}%,kode_md.ilike.%${t}%`)
    return s
  }
  async function load() {
    const { data, count } = await filt(supabase.from('outlets').select('*', { count: 'exact' }).order('code').range(page * PAGE, page * PAGE + PAGE - 1))
    setRows(data || []); setTotal(count || 0)
  }
  async function unduh() {
    try {
      const all = await fetchAll((a, b) => filt(supabase.from('outlets').select('*').order('code').range(a, b)))
      if (!all.length) return alert('Tidak ada data untuk diunduh.')
      const kd = Object.fromEntries(cabang.map(c => [c.id, c.kode]))
      const data = all.map(o => ({ 'Outlet ID': o.ext_id || '', 'Outlet Code': o.code, Cabang: kd[o.cabang_id] || '', 'Kode MD': o.kode_md || '', Rayon: o.rayon ? 'R' + String(o.rayon).padStart(2, '0') : '',
        Cycle: o.cycle || '', Name: o.name, Address: o.address, Province: o.province_name || '', City: o.city_name || '', District: o.district || '', Village: o.village || '',
        Latitude: o.lat ?? '', Longitude: o.long ?? '', Category: o.category || '', Account: o.account || '', 'Profile Outlet': o.profile_outlet || '', Owner: o.owner || '', Phone: o.phone || '',
        Status: o.status, 'Created at': o.created_at ? dt(o.created_at) : '' }))
      const XLSX = await import('xlsx'); const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'OUTLET')
      XLSX.writeFile(wb, `OUTLET_${day(new Date())}.xlsx`)
    } catch (e: any) { alert(e.message || 'Gagal mengunduh') }
  }
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t) }, [cid, rayon, q, page, kmd])
  const kode = (id: string) => cabang.find(c => c.id === id)?.kode

  async function save() {
    const la = ed.lat === '' || ed.lat == null ? null : Number(ed.lat), lo = ed.long === '' || ed.long == null ? null : Number(ed.long)
    const k = kode(ed.cabang_id)
    const why = !ed.name.trim() ? 'Nama wajib diisi' : !ed.address.trim() ? 'Alamat wajib diisi'
      : !(ed.kode_md || '').startsWith(k + '-') ? `KODE MD harus diawali ${k}-` : !(+ed.rayon >= 1 && +ed.rayon <= 24) ? 'Rayon harus 1–24'
      : (la === null) !== (lo === null) ? 'Lat/long: isi keduanya atau kosongkan keduanya'
      : la !== null && (isNaN(la) || isNaN(lo!) || Math.abs(la) > 90 || Math.abs(lo!) > 180) ? 'Lat/long tidak valid' : ''
    if (why) return setErr(why)
    const { error } = await supabase.from('outlets').update({ name: ed.name.trim(), address: ed.address.trim(), lat: la, long: lo, rayon: +ed.rayon,
      kode_md: ed.kode_md.trim(), city_name: ed.city_name || null, district: ed.district || null, village: ed.village || null, category: ed.category || null, account: ed.account || null, profile_outlet: ed.profile_outlet || null, status: ed.status }).eq('id', ed.id)
    setErr(error ? error.message : ''); if (!error) { setEd(null); load() }
  }
  const f = (k: string, ph: string) => <input placeholder={ph} value={ed[k] ?? ''} onChange={e => setEd({ ...ed, [k]: e.target.value })} />

  return (<>
    <div className="row"><h2 style={{ margin: 0 }}>Outlet</h2><div className="grow" /><button className="ghost" onClick={unduh}><Icon name="download" size={18} /> Download Excel</button><Link href="/import"><button>Import DMP</button></Link></div>
    <div className="row">
      <select value={cid} onChange={e => { setCid(e.target.value); setPage(0) }}>
        <option value="">Semua cabang</option>{cabang.map(c => <option key={c.id} value={c.id}>{c.kode} {c.nama}</option>)}
      </select>
      <select value={rayon} onChange={e => { setRayon(e.target.value); setPage(0) }}>
        <option value="">Semua rayon</option>{Array.from({ length: 24 }, (_, i) => <option key={i} value={i + 1}>R{String(i + 1).padStart(2, '0')}</option>)}
      </select>
      <select value={kmd} onChange={e => { setKmd(e.target.value); setPage(0) }}>
        <option value="">Semua Kode MD</option>{kmds.map(k => <option key={k} value={k}>{k}</option>)}
      </select>
      <input placeholder="Cari nama / kode / KODE MD" value={q} onChange={e => { setQ(e.target.value); setPage(0) }} />
    </div>
    {ed && <div className="card">
      <b>Edit {ed.code}</b>
      <div className="row" style={{ marginTop: 8 }}>{f('name', 'Nama')}{f('address', 'Alamat')}{f('lat', 'Latitude')}{f('long', 'Longitude')}{f('rayon', 'Rayon (1–24)')}{f('kode_md', 'KODE MD')}
        {f('city_name', 'Kota')}{f('district', 'Kecamatan')}{f('village', 'Kelurahan')}{f('category', 'Category')}{f('account', 'Account')}{f('profile_outlet', 'Profile outlet')}
        <select value={ed.status} onChange={e => setEd({ ...ed, status: e.target.value })}><option>AKTIF</option><option>INAKTIF</option></select></div>
      {err && <p className="err">{err}</p>}
      <div className="row"><button onClick={save}>Simpan</button><button className="ghost" onClick={() => { setEd(null); setErr('') }}>Batal</button></div>
    </div>}
    <p className="muted">{total} outlet · halaman {page + 1} dari {Math.max(1, Math.ceil(total / PAGE))}</p>
    <div className="scroll"><table>
      <thead><tr><th>Kode</th><th>Nama</th><th>Alamat</th><th>Rayon</th><th>KODE MD</th><th>Lat, Long</th><th>Status</th><th /></tr></thead>
      <tbody>{rows.map(r => <tr key={r.id}><td>{r.code}</td><td>{r.name}</td><td>{r.address}</td><td>{r.rayon ? 'R' + String(r.rayon).padStart(2, '0') : '-'}</td>
        <td>{r.kode_md || '-'}</td><td>{r.lat == null ? <span className="err">belum ada</span> : `${r.lat}, ${r.long}`}</td><td>{r.status}</td>
        <td><button className="ghost" onClick={() => { setEd({ ...r }); setErr('') }}>Edit</button></td></tr>)}</tbody>
    </table></div>
    <div className="row" style={{ marginTop: 12 }}>
      <button className="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>← Sebelumnya</button>
      <button className="ghost" disabled={(page + 1) * PAGE >= total} onClick={() => setPage(page + 1)}>Berikutnya →</button>
    </div>
  </>)
}
export default function Page() { return <Shell roles={['mds', 'mdm', 'rmdm', 'tl', 'kormot']}><Outlet /></Shell> }
