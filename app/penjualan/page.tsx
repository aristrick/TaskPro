'use client'
import { useEffect, useState } from 'react'
import Shell from '../../components/Shell'
import Icon from '../../components/Icon'
import { SkelRows } from '../../components/Loaders'
import { supabase } from '../../lib/supabase'
import { useDialog } from '../../components/Dialog'
import { day, dt, rp, OFFSET } from '../../lib/rekap'
import { friendly } from '../../lib/friendly'

const SEL = 'id,checkin_at,checkout_at,effective,cabang(nama,tz),fl:profiles(user_id,nama),outlets(name,code),sales(id,qty,price,value,product_id)'
type Baris = { key: string; product_id: string; qty: string; price: string }
const lokal = (iso: string, tz: string) => new Date(iso).toLocaleString('sv-SE', { timeZone: tz }).replace(' ', 'T').slice(0, 16)   // untuk input datetime-local
const keIso = (v: string, tz: string) => new Date(`${v}:00${OFFSET[tz] || '+07:00'}`).toISOString()
const acak = () => Math.random().toString(36).slice(2)

// Editor satu kunjungan: waktu check-in/check-out dan semua baris penjualan (produk, jumlah, harga satuan). Dijalankan oleh fungsi database kunjungan_edit (khusus MDM).
function Editor({ v, prods, onClose, onSaved }: { v: any; prods: any[]; onClose: () => void; onSaved: () => void }) {
  const dlg = useDialog()
  const tz: string = v.cabang?.tz || 'Asia/Jakarta'
  const [ci, setCi] = useState(lokal(v.checkin_at, tz)); const [co, setCo] = useState(v.checkout_at ? lokal(v.checkout_at, tz) : '')
  const [lines, setLines] = useState<Baris[]>(() => v.sales.map((s: any) => ({ key: s.id, product_id: s.product_id, qty: String(s.qty), price: String(s.price) })))
  const [alasan, setAlasan] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [out, setOut] = useState(false)
  const setL = (k: string, patch: Partial<Baris>) => setLines(ls => ls.map(l => (l.key === k ? { ...l, ...patch } : l)))
  const total = lines.reduce((a, l) => a + (parseInt(l.qty, 10) || 0) * (Number(l.price) || 0), 0)
  const totalLama = v.sales.reduce((a: number, s: any) => a + Number(s.value), 0)
  const tutup = () => { setOut(true); setTimeout(onClose, 220) }

  async function simpan() {
    const items = lines.map(l => ({ product_id: l.product_id, qty: parseInt(l.qty, 10), price: l.price === '' ? null : Number(l.price) }))
    const salah = !ci || !co ? 'Waktu check-in dan check-out wajib diisi.'
      : new Date(keIso(co, tz)) < new Date(keIso(ci, tz)) ? 'Check-out tidak boleh sebelum check-in.'
      : items.some(i => !i.product_id) ? 'Pilih produk pada setiap baris.'
      : items.some(i => !Number.isInteger(i.qty) || i.qty <= 0) ? 'Jumlah (pcs) harus bilangan bulat lebih dari 0.'
      : items.some(i => i.price !== null && (isNaN(i.price) || i.price < 0)) ? 'Harga tidak valid.'
      : new Set(items.map(i => i.product_id)).size !== items.length ? 'Produk yang sama tidak boleh muncul dua kali.'
      : alasan.trim().length < 3 ? 'Alasan perubahan wajib diisi.' : ''
    if (salah) return setErr(salah)
    if (!(await dlg.confirm({ title: 'Simpan perubahan penjualan?', okText: 'Simpan', icon: 'edit',
      message: <>Total <b>{rp(totalLama)}</b> menjadi <b>{rp(total)}</b>, {lines.length} baris produk. Perubahan tercatat di Jejak Audit beserta alasannya.</> }))) return
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('kunjungan_edit', { p_visit: v.id, p_checkin: keIso(ci, tz), p_checkout: keIso(co, tz), p_items: items, p_alasan: alasan.trim() })
    setBusy(false)
    if (error) return setErr(friendly(error))
    await dlg.alert({ title: 'Perubahan tersimpan', tone: 'ok', message: 'Tercatat di Jejak Audit: nilai lama, nilai baru, dan alasan.' })
    onSaved()
  }

  return (
    <div className={`modal wide ${out ? 'out' : ''}`}><div>
      <div className="row"><h3 style={{ margin: 0 }}>Edit penjualan</h3><div className="grow" /><button className="ghost" onClick={tutup}><Icon name="close" size={16} /> Tutup</button></div>
      <p className="muted" style={{ margin: '0 0 12px' }}><b>{v.outlets?.name}</b> ({v.outlets?.code}) · {v.fl?.user_id} {v.fl?.nama} · {v.cabang?.nama}</p>

      <section className="fsec">
        <div className="fsec-t">Waktu kunjungan (zona {tz === 'Asia/Jakarta' ? 'WIB' : tz === 'Asia/Makassar' ? 'WITA' : 'WIT'})</div>
        <div className="formgrid">
          <label className="fld"><span className="label">Check-in</span><input type="datetime-local" value={ci} onChange={e => setCi(e.target.value)} /></label>
          <label className="fld"><span className="label">Check-out</span><input type="datetime-local" value={co} onChange={e => setCo(e.target.value)} /></label>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>Mengubah tanggal memindahkan penjualan ke hari yang baru di Rekap dan Report.</p>
      </section>

      <section className="fsec">
        <div className="fsec-t">Baris penjualan</div>
        <div className="scroll" style={{ boxShadow: 'none' }}><table>
          <thead><tr><th>Produk</th><th>Pcs</th><th>Harga satuan</th><th>Subtotal</th><th /></tr></thead>
          <tbody>
            {lines.length === 0 && <tr><td colSpan={5} className="muted">Tidak ada baris. Kunjungan akan tercatat tanpa penjualan.</td></tr>}
            {lines.map(l => <tr key={l.key}>
              <td style={{ minWidth: 240 }}><select aria-label="Produk" value={l.product_id} onChange={e => setL(l.key, { product_id: e.target.value, price: String(prods.find(p => p.id === e.target.value)?.price ?? '') })}>
                <option value="">Pilih produk…</option>{prods.map(p => <option key={p.id} value={p.id}>{p.product}{p.active ? '' : ' (nonaktif)'}</option>)}</select></td>
              <td><input className="tin" aria-label="Jumlah pcs" inputMode="numeric" value={l.qty} onChange={e => setL(l.key, { qty: e.target.value.replace(/\D/g, '') })} /></td>
              <td><input className="tin" aria-label="Harga satuan" inputMode="decimal" value={l.price} onChange={e => setL(l.key, { price: e.target.value.replace(/[^\d.]/g, '') })} /></td>
              <td style={{ whiteSpace: 'nowrap' }}>{rp((parseInt(l.qty, 10) || 0) * (Number(l.price) || 0))}</td>
              <td><button className="ghost danger small" aria-label="Hapus baris" onClick={() => setLines(ls => ls.filter(x => x.key !== l.key))}><Icon name="trash" size={16} /></button></td>
            </tr>)}
          </tbody></table></div>
        <div className="row" style={{ margin: '12px 0 0' }}>
          <button className="ghost" onClick={() => setLines(ls => [...ls, { key: acak(), product_id: '', qty: '1', price: '' }])}><Icon name="plus" size={16} /> Tambah produk</button>
          <div className="grow" /><b style={{ fontSize: 18, color: 'var(--navy)' }}>Total {rp(total)}</b>
        </div>
      </section>

      <section className="fsec">
        <label className="fld" style={{ margin: 0 }}><span className="label">Alasan perubahan <i className="req">*</i></span>
          <input value={alasan} placeholder="mis. salah tanggal input, koreksi jumlah" onChange={e => setAlasan(e.target.value)} /></label>
      </section>
      <p className="hint-box" style={{ margin: '0 0 12px' }}>Stok pembawaan tidak dihitung ulang. Jika perlu, sesuaikan di halaman Stok.</p>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="stickybar"><div className="row" style={{ margin: 0 }}><button className="ghost" onClick={tutup}>Batal</button><div className="grow" />
        <button disabled={busy} aria-busy={busy} onClick={simpan}>{busy ? 'Menyimpan…' : 'Simpan perubahan'}</button></div></div>
    </div></div>)
}

function Penjualan() {
  const dlg = useDialog()
  const [from, setFrom] = useState(() => day(new Date(Date.now() - 6 * 864e5))); const [to, setTo] = useState(() => day(new Date()))
  const [cabs, setCabs] = useState<any[]>([]); const [cab, setCab] = useState('')
  const [fls, setFls] = useState<any[]>([]); const [fl, setFl] = useState('')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<any[] | null>(null)
  const [prods, setProds] = useState<any[]>([])
  const [edit, setEdit] = useState<any>(null)

  async function load() {
    setRows(null)
    let qq = supabase.from('visits').select(SEL).gte('checkin_at', `${from}T00:00:00+09:00`).lte('checkin_at', `${to}T23:59:59.999+07:00`).order('checkin_at', { ascending: false }).limit(500)
    if (cab) qq = qq.eq('cabang_id', cab)
    if (fl) qq = qq.eq('frontliner_id', fl)
    const { data, error } = await qq
    if (error) { await dlg.alert({ title: 'Gagal memuat data', message: friendly(error), tone: 'danger', icon: 'close' }); return setRows([]) }
    setRows((data || []).filter((v: any) => { const d = day(v.checkin_at, v.cabang?.tz || 'Asia/Jakarta'); return d >= from && d <= to }))
  }
  useEffect(() => {
    supabase.from('cabang').select('id,kode,nama').order('kode').then(({ data }) => setCabs(data || []))
    supabase.from('profiles').select('id,user_id,nama,cabang_id').eq('role', 'frontliner').order('user_id').then(({ data }) => setFls(data || []))
    supabase.from('products').select('id,product,price,active').order('product').then(({ data }) => setProds(data || []))
  }, [])
  useEffect(() => { load() }, [from, to, cab, fl])

  const t = q.trim().toLowerCase()
  const tampil = (rows || []).filter(v => !t || `${v.outlets?.name} ${v.outlets?.code} ${v.fl?.user_id} ${v.fl?.nama}`.toLowerCase().includes(t))
  const flOpsi = fls.filter(f => !cab || f.cabang_id === cab)
  return (<>
    <div className="pagehead"><div><h2>Edit Penjualan</h2><p className="muted">Koreksi tanggal, produk, jumlah, dan harga pada kunjungan. Khusus MDM, wajib beralasan, dan tercatat di Jejak Audit.</p></div></div>
    <div className="card"><div className="row" style={{ margin: 0 }}>
      <label className="fld"><span className="label">Dari tanggal</span><input type="date" value={from} onChange={e => e.target.value && setFrom(e.target.value)} /></label>
      <label className="fld"><span className="label">Sampai tanggal</span><input type="date" value={to} onChange={e => e.target.value && setTo(e.target.value)} /></label>
      <label className="fld"><span className="label">Cabang</span><select value={cab} onChange={e => { setCab(e.target.value); setFl('') }}><option value="">Semua cabang</option>{cabs.map(c => <option key={c.id} value={c.id}>{c.kode} · {c.nama}</option>)}</select></label>
      <label className="fld"><span className="label">Frontliner</span><select value={fl} onChange={e => setFl(e.target.value)}><option value="">Semua frontliner</option>{flOpsi.map(f => <option key={f.id} value={f.id}>{f.user_id} · {f.nama}</option>)}</select></label>
    </div></div>
    <div className="toolbar"><label className="searchbox"><Icon name="search" size={18} /><input placeholder="Cari outlet, kode outlet, atau frontliner…" aria-label="Cari" value={q} onChange={e => setQ(e.target.value)} /></label>
      {rows && <span className="muted">{tampil.length} kunjungan{rows.length >= 500 ? ' (dibatasi 500; persempit filter)' : ''}</span>}</div>
    {rows === null ? <SkelRows n={5} /> : tampil.length === 0 ? <div className="card muted">Tidak ada kunjungan pada filter ini.</div> :
      <div className="scroll"><table>
        <thead><tr><th>Waktu check-in</th><th>Frontliner</th><th>Outlet</th><th>Penjualan</th><th>Total</th><th /></tr></thead>
        <tbody>{tampil.map(v => {
          const pcs = v.sales.reduce((a: number, s: any) => a + s.qty, 0), tot = v.sales.reduce((a: number, s: any) => a + Number(s.value), 0)
          return <tr key={v.id}><td>{dt(v.checkin_at, v.cabang?.tz)}</td><td>{v.fl?.user_id} · {v.fl?.nama}</td>
            <td>{v.outlets?.name}<div className="muted" style={{ fontSize: 12 }}>{v.outlets?.code}</div></td>
            <td>{v.sales.length ? `${v.sales.length} produk · ${pcs} pcs` : <span className="muted">tanpa penjualan</span>}</td><td>{rp(tot)}</td>
            <td>{v.checkout_at ? <button className="ghost" onClick={() => setEdit(v)}><Icon name="edit" size={16} /> Edit</button> : <span className="chip warnchip" title="Frontliner belum check-out">Berjalan</span>}</td></tr>
        })}</tbody></table></div>}
    {edit && <Editor v={edit} prods={prods} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
  </>)
}
export default function Page() { return <Shell roles={['mdm']}><Penjualan /></Shell> }
