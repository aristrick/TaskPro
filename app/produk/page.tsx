'use client'
import { useEffect, useState } from 'react'
import Shell from '../../components/Shell'
import { supabase } from '../../lib/supabase'

const EMPTY = { product: '', sku_code: '', brand: '', category_product: '', price: '' }
function Produk() {
  const [rows, setRows] = useState<any[]>([])
  const [f, setF] = useState(EMPTY)
  const [err, setErr] = useState('')
  async function load() { const { data } = await supabase.from('products').select('*').order('product'); setRows(data || []) }
  useEffect(() => { load() }, [])
  async function add() {
    if (!f.product.trim() || f.price === '' || isNaN(+f.price)) return setErr('Nama produk dan harga (angka) wajib diisi')
    const { error } = await supabase.from('products').insert({ ...f, price: +f.price })
    setErr(error ? (error.message.includes('duplicate') ? 'Produk sudah ada' : error.message) : ''); if (!error) { setF(EMPTY); load() }
  }
  async function upd(id: string, patch: any) { await supabase.from('products').update(patch).eq('id', id); load() }
  const inp = (k: keyof typeof EMPTY, ph: string) => <input placeholder={ph} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} />
  return (<>
    <h2>Produk</h2>
    <div className="row">{inp('product', 'Produk (mis. MAC RTD)')}{inp('sku_code', 'SKU Code')}{inp('brand', 'Brand')}{inp('category_product', 'Kategori')}{inp('price', 'Harga')}<button onClick={add}>Tambah</button></div>
    {err && <p className="err">{err}</p>}
    <div className="scroll"><table>
      <thead><tr><th>Produk</th><th>SKU</th><th>Brand</th><th>Kategori</th><th>Harga</th><th>Fokus</th><th>Aktif</th></tr></thead>
      <tbody>{rows.map(r => <tr key={r.id}><td>{r.product}</td><td>{r.sku_code}</td><td>{r.brand}</td><td>{r.category_product}</td>
        <td>{Number(r.price).toLocaleString('id-ID')} <button className="ghost" onClick={() => { const v = prompt('Harga baru', r.price); if (v !== null && v !== '' && !isNaN(+v)) upd(r.id, { price: +v }) }}>Ubah</button></td>
        <td><input type="checkbox" checked={r.is_focus} onChange={e => upd(r.id, { is_focus: e.target.checked })} /></td>
        <td><input type="checkbox" checked={r.active} onChange={e => upd(r.id, { active: e.target.checked })} /></td></tr>)}</tbody>
    </table></div>
    <p className="muted">Harga yang diubah hanya berlaku untuk penjualan berikutnya. Produk tidak dihapus, cukup dinonaktifkan agar riwayat penjualan tetap utuh.</p>
  </>)
}
export default function Page() { return <Shell roles={['mds', 'mdm', 'rmdm']}><Produk /></Shell> }
