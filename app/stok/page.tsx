'use client'
import { useEffect, useState } from 'react'
import Shell from '../../components/Shell'
import Icon from '../../components/Icon'
import { SkelRows } from '../../components/Loaders'
import { supabase } from '../../lib/supabase'
import { loadMe } from '../../lib/auth'
import { useDialog } from '../../components/Dialog'
import { day, fetchAll } from '../../lib/rekap'
import { friendly } from '../../lib/friendly'

// Pantau stok pembawaan per hari: dibawa, terjual, sisa. MDS/RMDM/MDM dapat mengoreksi (wajib beralasan, tercatat di audit).
function Stok() {
  const dlg = useDialog()
  const [role, setRole] = useState('')
  const [tgl, setTgl] = useState(() => day(new Date()))
  const [cabs, setCabs] = useState<any[]>([]); const [cab, setCab] = useState('')
  const [fls, setFls] = useState<any[]>([]); const [prods, setProds] = useState<Record<string, any>>({})
  const [rows, setRows] = useState<any[]>([]); const [loading, setLoading] = useState(true)
  const admin = ['mds', 'mdm', 'rmdm'].includes(role)

  async function load() {
    setLoading(true)
    try {
      const [{ data: f }, { data: p }, rs] = await Promise.all([
        supabase.from('profiles').select('id,user_id,nama,cabang_id').eq('role', 'frontliner').order('user_id'),
        supabase.from('products').select('id,product,brand'),
        fetchAll((a, b) => supabase.rpc('stok_laporan', { p_from: tgl, p_to: tgl, p_cabang: cab || null, p_frontliner: null }).range(a, b) as any)])
      setFls(f || []); setProds(Object.fromEntries((p || []).map(x => [x.id, x]))); setRows(rs)
    } catch (e: any) { await dlg.alert({ title: 'Gagal memuat stok', message: friendly(e), tone: 'danger', icon: 'close' }) }
    setLoading(false)
  }
  useEffect(() => { loadMe().then(({ me }) => setRole(me?.role || '')); supabase.from('cabang').select('id,kode,nama').order('kode').then(({ data }) => setCabs(data || [])) }, [])
  useEffect(() => { load() }, [tgl, cab])

  async function koreksi(f: any, r: any) {
    const nama = prods[r.product_id]?.product || 'produk'
    const v = await dlg.form({ title: `Koreksi stok ${nama}`, okText: 'Simpan', message: `${f.user_id} · ${f.nama}. Terjual ${r.terjual} pcs; stok tidak boleh kurang dari itu.`,
      fields: [{ key: 'total', label: 'Total dibawa (pcs)', value: String(r.dibawa), inputMode: 'numeric' }, { key: 'alasan', label: 'Alasan koreksi (wajib)', placeholder: 'mis. salah hitung saat berangkat' }] })
    if (!v) return
    const n = parseInt(v.total, 10)
    if (isNaN(n) || n < 0) return void dlg.alert({ title: 'Jumlah tidak valid', message: 'Isi dengan angka 0 atau lebih.', tone: 'danger', icon: 'close' })
    const { error } = await supabase.rpc('stok_koreksi_admin', { p_frontliner: f.id, p_product: r.product_id, p_date: tgl, p_total: n, p_alasan: v.alasan || '' })
    if (error) return void dlg.alert({ title: 'Koreksi gagal', message: friendly(error), tone: 'danger', icon: 'close' })
    load()
  }

  const daftar = fls.filter(f => !cab || f.cabang_id === cab)
  const per = (id: string) => rows.filter(r => r.frontliner_id === id).sort((a, b) => (prods[a.product_id]?.product || '').localeCompare(prods[b.product_id]?.product || ''))
  const belum = daftar.filter(f => per(f.id).length === 0)
  return (<>
    <h2>Stok Pembawaan</h2>
    <div className="card"><div className="row" style={{ margin: 0 }}>
      <label className="fld"><span className="label">Tanggal</span><input type="date" value={tgl} onChange={e => e.target.value && setTgl(e.target.value)} /></label>
      {cabs.length > 1 && <label className="fld"><span className="label">Cabang</span><select value={cab} onChange={e => setCab(e.target.value)}><option value="">Semua cabang</option>{cabs.map(c => <option key={c.id} value={c.id}>{c.kode} · {c.nama}</option>)}</select></label>}
      {!loading && <span className={belum.length ? 'chip warnchip' : 'chip'}>{belum.length ? `${belum.length} frontliner belum mengisi stok` : 'Semua frontliner sudah mengisi stok'}</span>}
    </div></div>
    {loading ? <SkelRows n={4} /> : daftar.length === 0 ? <div className="card muted">Belum ada frontliner di cabang ini.</div> : daftar.map(f => {
      const rs = per(f.id), t = rs.reduce((a, r) => ({ d: a.d + r.dibawa, t: a.t + r.terjual }), { d: 0, t: 0 })
      return (
        <div className="card" key={f.id}>
          <div className="row" style={{ marginBottom: rs.length ? 8 : 0 }}><b>{f.user_id} · {f.nama}</b><div className="grow" />
            {rs.length ? <><span className="chip">Dibawa {t.d}</span><span className="chip">Terjual {t.t}</span><span className="chip">Sisa {t.d - t.t}</span></> : <span className="chip warnchip">Belum mengisi stok</span>}</div>
          {rs.length > 0 && <div className="scroll"><table>
            <thead><tr><th>Produk</th><th>Dibawa</th><th>Terjual</th><th>Sisa</th>{admin && <th />}</tr></thead>
            <tbody>{rs.map(r => <tr key={r.product_id}><td>{prods[r.product_id]?.product || '-'}</td><td>{r.dibawa}</td><td>{r.terjual}</td>
              <td className={r.dibawa - r.terjual < 0 ? 'err' : ''}>{r.dibawa - r.terjual}</td>
              {admin && <td><button className="ghost" onClick={() => koreksi(f, r)}><Icon name="edit" size={16} /> Koreksi</button></td>}</tr>)}</tbody></table></div>}
        </div>)
    })}
    <p className="muted">Stok diisi frontliner lewat Profile di HP. Koreksi oleh MDS/RMDM/MDM wajib beralasan dan tercatat di Jejak Audit. Sisa negatif berarti ada penjualan yang melebihi stok (terjadi jika aturan batas stok dimatikan).</p>
  </>)
}
export default function Page() { return <Shell roles={['mds', 'mdm', 'rmdm', 'tl', 'kormot']}><Stok /></Shell> }
