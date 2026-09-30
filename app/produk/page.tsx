'use client'
import { useEffect, useState } from 'react'
import Shell from '../../components/Shell'
import Icon from '../../components/Icon'
import { supabase } from '../../lib/supabase'
import { useDialog } from '../../components/Dialog'

const EMPTY = { product: '', sku_code: '', brand: '', category_product: '', price: '' }
function Produk() {
  const dlg = useDialog()
  const [rows, setRows] = useState<any[]>([])
  const [f, setF] = useState<any>(EMPTY)
  const [editId, setEditId] = useState('')
  const [err, setErr] = useState('')
  async function load() { const { data } = await supabase.from('products').select('*').order('product'); setRows(data || []) }
  useEffect(() => { load() }, [])
  async function simpan() {
    if (!f.product.trim() || f.price === '' || isNaN(+f.price)) return setErr('Nama produk dan harga (angka) wajib diisi')
    const d = { product: f.product.trim(), sku_code: f.sku_code, brand: f.brand, category_product: f.category_product, price: +f.price }
    const { error } = editId ? await supabase.from('products').update(d).eq('id', editId) : await supabase.from('products').insert(d)
    setErr(error ? (error.message.includes('duplicate') ? 'Nama produk sudah ada' : error.message) : '')
    if (!error) { setF(EMPTY); setEditId(''); load() }
  }
  function edit(r: any) { setEditId(r.id); setF({ product: r.product, sku_code: r.sku_code || '', brand: r.brand || '', category_product: r.category_product || '', price: String(r.price) }); setErr(''); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  async function hapus(r: any) {
    if (!(await dlg.confirm({ title: 'Hapus produk?', tone: 'danger', okText: 'Hapus', message: <><b>{r.product}</b> akan dihapus permanen.</> }))) return
    const { error } = await supabase.from('products').delete().eq('id', r.id)
    setErr(error ? (error.code === '23503' ? `${r.product} sudah punya riwayat penjualan, jadi tidak bisa dihapus. Nonaktifkan saja (hilangkan centang Aktif).` : error.message) : ''); load()
  }
  async function upd(id: string, patch: any) { await supabase.from('products').update(patch).eq('id', id); load() }
  const inp = (k: string, ph: string) => <input placeholder={ph} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} />
  return (<>
    <h2>Produk</h2>
    <div className="card"><span className="label" style={{ marginBottom: 8 }}>{editId ? 'Edit produk' : 'Tambah produk'}</span>
      <div className="row" style={{ margin: 0 }}>{inp('product', 'Produk (mis. MAC RTD)')}{inp('sku_code', 'SKU Code')}{inp('brand', 'Brand')}{inp('category_product', 'Kategori')}{inp('price', 'Harga')}
        <button onClick={simpan}>{editId ? 'Simpan perubahan' : 'Tambah'}</button>
        {editId && <button className="ghost" onClick={() => { setEditId(''); setF(EMPTY); setErr('') }}>Batal</button>}</div>
      {err && <p className="err" role="alert" style={{ marginBottom: 0 }}>{err}</p>}</div>
    <div className="scroll"><table>
      <thead><tr><th>Produk</th><th>SKU</th><th>Brand</th><th>Kategori</th><th>Harga</th><th>Fokus</th><th>Aktif</th><th /></tr></thead>
      <tbody>{rows.map(r => <tr key={r.id}><td>{r.product}</td><td>{r.sku_code}</td><td>{r.brand}</td><td>{r.category_product}</td>
        <td>{Number(r.price).toLocaleString('id-ID')}</td>
        <td><input type="checkbox" checked={r.is_focus} onChange={e => upd(r.id, { is_focus: e.target.checked })} /></td>
        <td><input type="checkbox" checked={r.active} onChange={e => upd(r.id, { active: e.target.checked })} /></td>
        <td style={{ whiteSpace: 'nowrap' }}><button className="ghost" onClick={() => edit(r)}><Icon name="edit" size={16} /> Edit</button> <button className="ghost danger" onClick={() => hapus(r)}><Icon name="trash" size={16} /> Hapus</button></td></tr>)}</tbody>
    </table></div>
    <p className="muted">Harga yang diubah hanya berlaku untuk penjualan berikutnya. Produk yang sudah pernah terjual tidak bisa dihapus; nonaktifkan agar riwayat tetap utuh.</p>
  </>)
}
export default function Page() { return <Shell roles={['mds', 'mdm', 'rmdm']}><Produk /></Shell> }
