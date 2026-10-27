'use client'
import { useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import Icon from '../Icon'
import QtyInput from './QtyInput'
import { SkelRows } from '../Loaders'
import { rp } from '../../lib/rekap'
import { buzz, mmss, sisaDetik } from '../../lib/hp'
import type { Kunjungan, Produk, StokMap } from '../../lib/types'
import type { Qty } from './hooks'

// Layar input penjualan saat kunjungan berjalan: pencarian produk, daftar produk (fokus dulu), ringkasan, dan tombol check-out.
export default function SellScreen({ visit, tz, anim, produk, siap, terakhir, fokus, qty, setQty, stok, enforce, stokSiap, sisaOf, minCo, busy, err, onKeluar, onStok, atas, children }: {
  visit: Kunjungan; tz: string; anim: string; produk: Produk[]; siap: boolean; terakhir: Qty; fokus: Set<string>
  qty: Qty; setQty: Dispatch<SetStateAction<Qty>>; stok: StokMap; enforce: boolean; stokSiap: boolean; sisaOf: (id: string) => number
  minCo: number; busy: boolean; err: string; onKeluar: () => void; onStok: () => void; atas?: ReactNode; children?: ReactNode }) {
  const [pq, setPq] = useState('')
  const [pf, setPf] = useState<'all' | 'focus' | 'sel'>('all')
  const [confirmOut, setConfirmOut] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)   // produk yang jumlahnya sedang diketik: tetap tampil walau jumlahnya sementara 0
  const [, setTick] = useState(0)
  useEffect(() => { if (!minCo) return; const t = setInterval(() => setTick(x => x + 1), 1000); return () => clearInterval(t) }, [visit.id, minCo])

  const sisa = sisaDetik(visit.checkin_at, minCo)
  const total = produk.reduce((a, x) => a + (qty[x.id] || 0) * Number(x.price), 0)
  const items = produk.filter(x => qty[x.id] > 0).length
  const pcs = produk.reduce((a, x) => a + (qty[x.id] || 0), 0)
  const ch = (id: string, v: number) => { buzz(8); setQty(q => ({ ...q, [id]: Math.max(0, Math.min(9999, sisaOf(id), Math.round(v) || 0)) })) }
  const totalSisa = produk.reduce((a, x) => a + sisaOf(x.id) * (enforce ? 1 : 0), 0)
  const noStock = enforce && stokSiap && produk.length > 0 && totalSisa === 0
  const inTime = visit.checkin_at ? new Date(visit.checkin_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: tz }) : ''
  const nFocus = produk.filter(x => fokus.has(x.id)).length
  const shown = produk.filter(x => (!pq.trim() || (x.product + ' ' + (x.brand || '')).toLowerCase().includes(pq.trim().toLowerCase()))
    && (pf === 'all' || (pf === 'focus' ? fokus.has(x.id) : qty[x.id] > 0)))
  const focusRows = shown.filter(x => fokus.has(x.id)), otherRows = shown.filter(x => !fokus.has(x.id))

  const prodRow = (x: Produk) => {
    const n = qty[x.id] || 0, price = Number(x.price), s = sisaOf(x.id), lim = enforce && stokSiap
    return (
      <div key={x.id} className={`prow ${n > 0 ? 'on' : ''}`} onClick={() => n === 0 && (!lim || s > 0) && ch(x.id, 1)}>
        <div><div className="pname2">{x.product}{fokus.has(x.id) && <span className="badge">FOKUS</span>}</div>
          <div className="pmeta">{[x.brand, rp(price)].filter(Boolean).join(' · ')}{lim && <span className={`stk ${s === 0 ? 'zero' : s <= 5 ? 'low' : ''}`}> · Sisa {s}</span>}</div></div>
        {n === 0 && editId !== x.id
          ? <button className="addbtn" disabled={lim && s === 0} aria-label={`Tambah ${x.product}`} onClick={e => { e.stopPropagation(); ch(x.id, 1) }}><Icon name="plus" size={20} /></button>
          : <div className="stepper" onClick={e => e.stopPropagation()}>
              <button aria-label="Kurangi" onClick={() => ch(x.id, n - 1)}><Icon name="minus" size={18} /></button>
              <QtyInput nilai={n} maks={s} label={`Jumlah ${x.product}`} onUbah={v => ch(x.id, v)} onFokus={() => setEditId(x.id)} onSelesai={() => setEditId(null)} />
              <button aria-label="Tambah" disabled={lim && n >= s} onClick={() => ch(x.id, n + 1)}><Icon name="plus" size={18} /></button></div>}
        {n > 0 && <div className="psub"><span>{n} × {rp(price)}{lim && n >= s && <span className="stk zero"> · sesuai sisa stok</span>}</span><b key={n} className="pop">{rp(n * price)}</b></div>}
      </div>)
  }

  return (
    <div className={`phone dark ${anim}`}>
      {children}
      {confirmOut && <div className="overlay" onClick={() => setConfirmOut(false)}><div className="dialog left" role="dialog" onClick={e => e.stopPropagation()}>
        <h3>{items ? 'Simpan penjualan & check-out?' : 'Check-out tanpa penjualan?'}</h3>
        {items ? <div className="sumlist">
            {produk.filter(x => qty[x.id] > 0).map(x => <div className="line" key={x.id}><span>{qty[x.id]} × {x.product}</span><b>{rp(qty[x.id] * Number(x.price))}</b></div>)}
            <div className="line tot"><span>Total</span><b>{rp(total)}</b></div></div>
          : <p>Belum ada produk yang diisi. Kunjungan akan dicatat tanpa penjualan (bukan Effective Call).</p>}
        <div className="dbtns"><button className="ghost" onClick={() => setConfirmOut(false)}>Kembali</button>
          <button disabled={busy} onClick={() => { setConfirmOut(false); onKeluar() }}>{items ? 'Simpan & Check-out' : 'Check-out'}</button></div></div></div>}
      <div className="hero compact"><span className="label">Kunjungan berjalan · sejak {inTime}</span><h2>{visit.outlets?.name}</h2><div className="hint">{visit.outlets?.address}</div></div>
      {atas}
      <div className="sheet">
        {noStock && <div className="notice warn row"><span className="grow">{Object.values(stok).some(x => x.dibawa > 0) ? 'Stok pembawaan hari ini sudah habis terjual.' : 'Belum ada stok pembawaan hari ini. Tambahkan dulu agar penjualan bisa diinput.'}</span>
          <button className="ghost small" onClick={onStok}>Tambahkan stok</button></div>}
        <div className="shead">
          <div className="searchbox"><Icon name="search" size={18} /><input placeholder="Cari produk…" aria-label="Cari produk" value={pq} onChange={e => setPq(e.target.value)} /></div>
          <div className="seg" role="tablist">
            {([['all', `Semua ${produk.length}`], ['focus', `Fokus ${nFocus}`], ['sel', `Terpilih ${items}`]] as const).map(([k, t]) =>
              <button key={k} role="tab" aria-selected={pf === k} className={pf === k ? 'on' : ''} onClick={() => setPf(k)}>{t}</button>)}</div>
          {Object.keys(terakhir).length > 0 && <button className="ghost small" onClick={() => setQty(terakhir)}><Icon name="refresh" size={16} /> Isi seperti kunjungan terakhir</button>}
        </div>
        {!siap && <SkelRows n={6} />}
        {siap && shown.length === 0 && <div className="empty"><b>{pf === 'sel' && !pq ? 'Belum ada produk dipilih' : 'Produk tidak ditemukan'}</b>
          <p className="muted">{pf === 'sel' && !pq ? 'Ketuk tombol ＋ pada produk untuk menambahkannya.' : 'Coba kata kunci lain atau pilih tab Semua.'}</p></div>}
        {focusRows.length > 0 && <><span className="label sec">Produk fokus</span>{focusRows.map(prodRow)}</>}
        {otherRows.length > 0 && <>{focusRows.length > 0 && <span className="label sec">Produk lain</span>}{otherRows.map(prodRow)}</>}
        {err && <p className="err" role="alert">{err}</p>}
      </div>
      <div className="stickybar sumbar">
        <div className="sumtxt">{items ? <><span className="muted">{items} produk · {pcs} pcs</span><b>{rp(total)}</b></> : <span className="muted">Belum ada penjualan</span>}{sisa > 0 && <span className="cdown"><Icon name="lock" size={12} /> Check-out tersedia dalam {mmss(sisa)} (batas {minCo} menit)</span>}</div>
        <button disabled={busy || sisa > 0} aria-busy={busy} onClick={() => setConfirmOut(true)}>{busy ? 'Memproses…' : sisa > 0 ? `Check-out (${mmss(sisa)})` : 'Check-out'}</button>
      </div>
    </div>)
}
