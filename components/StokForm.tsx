'use client'
import { useEffect, useState } from 'react'
import { SkelRows } from './Loaders'
import { supabase } from '../lib/supabase'
import { useDialog } from './Dialog'
import Icon from './Icon'

// Stok pembawaan hari ini (WIB). "Tambahkan" bersifat kumulatif (boleh isi ulang siang hari).
// "Koreksi" mengganti total satu produk, tidak boleh di bawah yang sudah terjual. Aturan dijaga di database.
type St = Record<string, { dibawa: number; terjual: number }>
export default function StokForm({ onClose, onSaved, focusIds }: { onClose: () => void; onSaved: () => void; focusIds: Set<string> }) {
  const dlg = useDialog()
  const [products, setProducts] = useState<any[]>([])
  const [st, setSt] = useState<St>({})
  const [add, setAdd] = useState<Record<string, number>>({})
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [out, setOut] = useState(false); const [ready, setReady] = useState(false)

  async function load() {
    const [{ data: p }, { data: s, error }] = await Promise.all([
      supabase.from('products').select('*').eq('active', true).order('product'),
      supabase.rpc('stok_hari_ini')])
    if (error) setErr('Fitur stok belum aktif di server (jalankan 09_migration.sql).')
    setProducts((p || []).sort((a: any, b: any) => +focusIds.has(b.id) - +focusIds.has(a.id))); setSt(Object.fromEntries((s || []).map((x: any) => [x.product_id, { dibawa: x.dibawa, terjual: x.terjual }]))); setReady(true)
  }
  useEffect(() => { load() }, [])
  const close = () => { setOut(true); setTimeout(onClose, 220) }
  const setN = (id: string, v: number) => setAdd(a => ({ ...a, [id]: Math.max(0, Math.min(99999, Math.round(v) || 0)) }))
  const items = products.filter(x => add[x.id] > 0)
  const pcsAdd = items.reduce((a, x) => a + add[x.id], 0)
  const tot = Object.values(st).reduce((a, x) => ({ d: a.d + x.dibawa, t: a.t + x.terjual }), { d: 0, t: 0 })
  const shown = products.filter(x => !q.trim() || (x.product + ' ' + (x.brand || '')).toLowerCase().includes(q.trim().toLowerCase()))

  async function simpan() {
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('stok_tambah', { p_items: items.map(x => ({ product_id: x.id, qty: add[x.id] })) })
    setBusy(false); if (error) return setErr(error.message)
    setAdd({}); await load(); onSaved()
  }
  async function koreksi(x: any) {
    const cur = st[x.id]?.dibawa || 0, sold = st[x.id]?.terjual || 0
    const v = await dlg.form({ title: `Koreksi stok ${x.product}`, message: `Sudah terjual hari ini: ${sold} pcs. Total stok tidak boleh kurang dari itu.`, okText: 'Simpan',
      fields: [{ key: 'total', label: 'Total dibawa hari ini (pcs)', value: String(cur), inputMode: 'numeric' }] })
    if (!v) return
    const n = parseInt(v.total, 10)
    if (isNaN(n) || n < 0) return void dlg.alert({ title: 'Jumlah tidak valid', message: 'Isi dengan angka 0 atau lebih.', tone: 'danger', icon: 'close' })
    const { error } = await supabase.rpc('stok_koreksi', { p_product: x.id, p_total: n })
    if (error) return void dlg.alert({ title: 'Koreksi gagal', message: error.message, tone: 'danger', icon: 'close' })
    await load(); onSaved()
  }

  return (
    <div className={`modal ${out ? 'out' : ''}`}><div>
      <div className="row"><h3 style={{ margin: 0 }}>Stok Pembawaan</h3><div className="grow" /><button className="ghost" onClick={close}><Icon name="close" size={16} /> Tutup</button></div>
      <p className="muted" style={{ margin: '0 0 4px', fontSize: 13 }}>{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta' })} · berlaku untuk hari ini saja</p>
      <div className="stkbar"><div><b>{tot.d}</b><span>Dibawa</span></div><div><b>{tot.t}</b><span>Terjual</span></div><div><b>{tot.d - tot.t}</b><span>Sisa</span></div></div>
      <div className="searchbox"><Icon name="search" size={18} /><input placeholder="Cari produk…" aria-label="Cari produk" value={q} onChange={e => setQ(e.target.value)} /></div>
      <span className="label sec">Ketuk ＋ pada produk yang Anda bawa</span>
      {!ready && <SkelRows n={4} />}
      {shown.map(x => {
        const s = st[x.id], n = add[x.id] || 0
        return (
          <div key={x.id} className={`prow ${n > 0 ? 'on' : ''}`} onClick={() => n === 0 && setN(x.id, 1)}>
            <div><div className="pname2">{x.product}{focusIds.has(x.id) && <span className="badge">FOKUS</span>}</div>
              <div className="pmeta">{s ? `Dibawa ${s.dibawa} · Terjual ${s.terjual} · Sisa ${s.dibawa - s.terjual}` : 'Belum ada stok hari ini'}</div>
              {s && s.dibawa > 0 && <button className="linkbtn" onClick={e => { e.stopPropagation(); koreksi(x) }}>Koreksi total</button>}</div>
            {n === 0
              ? <button className="addbtn" aria-label={`Tambah stok ${x.product}`} onClick={e => { e.stopPropagation(); setN(x.id, 1) }}><Icon name="plus" size={20} /></button>
              : <div className="stepper" onClick={e => e.stopPropagation()}>
                  <button aria-label="Kurangi" onClick={() => setN(x.id, n - 1)}><Icon name="minus" size={18} /></button>
                  <input inputMode="numeric" aria-label={`Tambahan stok ${x.product}`} value={n} onFocus={e => e.target.select()}
                    onChange={e => { const v = e.target.value.replace(/\D/g, ''); setN(x.id, v === '' ? 1 : +v) }} />
                  <button aria-label="Tambah" onClick={() => setN(x.id, n + 1)}><Icon name="plus" size={18} /></button></div>}
            {n > 0 && <div className="psub"><span>Tambah {n} pcs</span><b>Total jadi {(s?.dibawa || 0) + n}</b></div>}
          </div>)
      })}
      {err && <p className="err" role="alert">{err}</p>}
      <div className="stickybar"><button disabled={busy || !items.length} aria-busy={busy} style={{ width: '100%' }} onClick={simpan}>
        {busy ? 'Menyimpan…' : items.length ? `Tambahkan ${pcsAdd} pcs ke stok` : 'Pilih produk yang dibawa'}</button></div>
    </div></div>)
}
