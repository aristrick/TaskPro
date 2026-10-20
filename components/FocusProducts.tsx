'use client'
import { useState } from 'react'

export type FokusItem = { nama: string; ec: number; qty: number }
const AWAL = 5

// Produk fokus: peringkat, nama (boleh dua baris), EC dan Qty berlabel jelas, serta batang proporsional terhadap Qty tertinggi.
export default function FocusProducts({ items }: { items: FokusItem[] }) {
  const [semua, setSemua] = useState(false)
  const maks = Math.max(1, ...items.map(x => x.qty)), tampil = semua ? items : items.slice(0, AWAL)
  return (
    <div className="focus">
      <ol className="focus-list">
        {tampil.map((x, i) => <li key={x.nama} className="focus-row">
          <span className="focus-rank" aria-hidden="true">{i + 1}</span>
          <span className="focus-name">{x.nama}</span>
          <span className="focus-nums">
            <span><small>EC</small><b>{x.ec.toLocaleString('id-ID')}</b></span>
            <span><small>Qty</small><b>{x.qty.toLocaleString('id-ID')}</b></span>
          </span>
          <span className="focus-bar" aria-hidden="true"><i style={{ width: `${Math.max(3, (x.qty / maks) * 100)}%` }} /></span>
        </li>)}
      </ol>
      {items.length > AWAL && <button type="button" className="ghost focus-more" aria-expanded={semua} onClick={() => setSemua(v => !v)}>{semua ? 'Tampilkan 5 teratas' : `Tampilkan semua (${items.length})`}</button>}
      <p className="trend-note">EC = jumlah outlet yang membeli. Qty = total pcs. Batang membandingkan Qty antarproduk.</p>
    </div>)
}
