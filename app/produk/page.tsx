'use client'
import { useEffect, useState } from 'react'
import { Switch } from '../../components/Switch'
import Shell from '../../components/Shell'
import PageHead from '../../components/PageHead'
import Icon from '../../components/Icon'
import { supabase } from '../../lib/supabase'
import { useDialog } from '../../components/Dialog'
import MenuAksi from '../../components/ui/MenuAksi'
import SidePanel from '../../components/ui/SidePanel'
import { n as fmtN } from '../../lib/angka'

const EMPTY = { product: '', sku_code: '', brand: '', category_product: '', price: '' }
function Produk() {
  const dlg = useDialog()
  const [rows, setRows] = useState<any[]>([])
  const [f, setF] = useState<any>(EMPTY)
  const [editId, setEditId] = useState('')
  const [err, setErr] = useState('')
  const [buka, setBuka] = useState(false)
  // Fokus bersifat per project: pilih project, lalu centang produk fokusnya
  const [projs, setProjs] = useState<any[]>([])
  const [cabs, setCabs] = useState<any[]>([])
  const [pid, setPid] = useState('')
  const [focus, setFocus] = useState<Set<string>>(new Set())
  async function loadProjects() {
    const [{ data: p }, { data: c }] = await Promise.all([supabase.from('projects').select('id,name,cabang_id').order('name'), supabase.from('cabang').select('id,kode').order('kode')])
    setProjs(p || []); setCabs(c || []); setPid(x => x || p?.[0]?.id || '')
  }
  async function loadFocus() {
    if (!pid) return setFocus(new Set())
    const { data } = await supabase.from('project_focus').select('product_id').eq('project_id', pid)
    setFocus(new Set((data || []).map((x: any) => x.product_id)))
  }
  useEffect(() => { loadProjects() }, [])
  useEffect(() => { loadFocus() }, [pid])
  async function toggleFokus(prod: string, on: boolean) {
    const { error } = on ? await supabase.from('project_focus').insert({ project_id: pid, product_id: prod })
      : await supabase.from('project_focus').delete().eq('project_id', pid).eq('product_id', prod)
    setErr(error ? error.message : ''); loadFocus()
  }
  const kode = (cid: string) => cabs.find(c => c.id === cid)?.kode
  async function load() { const { data } = await supabase.from('products').select('*').order('product'); setRows(data || []) }
  useEffect(() => { load() }, [])
  async function simpan() {
    if (!f.product.trim() || f.price === '' || isNaN(+f.price)) return setErr('Nama produk dan harga (angka) wajib diisi')
    const d = { product: f.product.trim(), sku_code: f.sku_code, brand: f.brand, category_product: f.category_product, price: +f.price }
    const { error } = editId ? await supabase.from('products').update(d).eq('id', editId) : await supabase.from('products').insert(d)
    setErr(error ? (error.message.includes('duplicate') ? 'Nama produk sudah ada' : error.message) : '')
    if (!error) { setF(EMPTY); setEditId(''); setBuka(false); load() }
  }
  function edit(r: any) { setEditId(r.id); setF({ product: r.product, sku_code: r.sku_code || '', brand: r.brand || '', category_product: r.category_product || '', price: String(r.price) }); setErr(''); setBuka(true) }
  async function hapus(r: any) {
    if (!(await dlg.confirm({ title: 'Hapus produk?', tone: 'danger', okText: 'Hapus', message: <><b>{r.product}</b> akan dihapus permanen.</> }))) return
    const { error } = await supabase.from('products').delete().eq('id', r.id)
    setErr(error ? (error.code === '23503' ? `${r.product} sudah punya riwayat penjualan, jadi tidak bisa dihapus. Nonaktifkan saja (hilangkan centang Aktif).` : error.message) : ''); load()
  }
  async function upd(id: string, patch: any) { await supabase.from('products').update(patch).eq('id', id); load() }
  const inp = (k: string, label: string, ph = '') => <label className="fld"><span className="label">{label}</span><input placeholder={ph} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} /></label>
  return (<>
    <PageHead title="Produk" desc="Daftar produk dan harganya. Produk fokus diatur per project di menu Project.">
      <button onClick={() => { setEditId(''); setF(EMPTY); setErr(''); setBuka(true) }}><Icon name="plus" size={18} /> Tambah</button>
    </PageHead>
    {buka && <SidePanel judul={editId ? 'Edit produk' : 'Tambah produk'} onClose={() => { setBuka(false); setEditId(''); setF(EMPTY); setErr('') }}>
      <div className="formstack">{inp('product', 'Produk', 'mis. MAC RTD')}{inp('sku_code', 'SKU Code')}{inp('brand', 'Brand')}{inp('category_product', 'Kategori')}{inp('price', 'Harga')}</div>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row" style={{ justifyContent: 'flex-end', margin: 0 }}><button className="ghost" onClick={() => { setBuka(false); setEditId(''); setF(EMPTY); setErr('') }}>Batal</button><button onClick={simpan}>{editId ? 'Simpan perubahan' : 'Tambah'}</button></div>
    </SidePanel>}
    {!buka && err && <p className="err" role="alert">{err}</p>}
    <div className="card">
      <span className="label" style={{ marginBottom: 8 }}>Produk fokus</span>
      {projs.length === 0 ? <p className="muted" style={{ margin: 0 }}>Belum ada project. Buat project di halaman Project, lalu pilih produk fokusnya di sini.</p> : <>
        <div className="row" style={{ margin: 0 }}>
          <select value={pid} onChange={e => setPid(e.target.value)} aria-label="Project untuk produk fokus">
            {projs.map(p => <option key={p.id} value={p.id}>{kode(p.cabang_id)} · {p.name}</option>)}</select>
          <span className="chip">{focus.size} produk fokus</span></div>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 13 }}>Nyalakan saklar di kolom <b>Fokus</b> pada tabel di bawah untuk project ini. Tiap project punya daftar fokus sendiri, dan frontliner mengikuti project-nya. Perubahan berlaku untuk penjualan berikutnya; riwayat tidak berubah.</p></>}
    </div>
    <div className="scroll"><table>
      <thead><tr><th>Produk</th><th>SKU</th><th>Brand</th><th>Kategori</th><th>Harga</th><th>Fokus</th><th>Aktif</th><th /></tr></thead>
      <tbody>{rows.map(r => <tr key={r.id}><td>{r.product}</td><td>{r.sku_code}</td><td>{r.brand}</td><td>{r.category_product}</td>
        <td>{fmtN(Number(r.price))}</td>
        <td><Switch label={`Fokus ${r.product}`} disabled={!pid || (!r.active && !focus.has(r.id))} title={!pid ? 'Pilih project dulu' : !r.active && !focus.has(r.id) ? 'Produk nonaktif' : ''} checked={focus.has(r.id)} onChange={v => toggleFokus(r.id, v)} /></td>
        <td><Switch label={`Aktif ${r.product}`} checked={r.active} onChange={v => upd(r.id, { active: v })} /></td>
        <td className="td-aksi"><MenuAksi label={`Aksi untuk ${r.product}`} items={[{ label: 'Edit produk', icon: 'edit', onClick: () => edit(r) }, { label: 'Hapus produk', icon: 'trash', danger: true, onClick: () => hapus(r) }]} /></td></tr>)}</tbody>
    </table></div>
    <p className="muted">Harga yang diubah hanya berlaku untuk penjualan berikutnya. Produk fokus juga bisa diatur per project di halaman Project. Produk yang sudah pernah terjual tidak bisa dihapus; nonaktifkan agar riwayat tetap utuh.</p>
  </>)
}
export default function Page() { return <Shell roles={['mds', 'mdm', 'rmdm']}><Produk /></Shell> }
