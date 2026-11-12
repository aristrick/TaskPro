'use client'
import { HARI, MINGGU, hariTerisi, kodeRayon, type Baris } from '../../lib/jadwal'

// Seluruh siklus sekaligus: 4 minggu x 6 hari. Satu ketukan pada sel membuka hari itu. Cocok untuk memeriksa apakah ada hari yang masih kosong atau rayon yang ganda.
export default function Ringkasan({ rows, posisi, onBuka }: { rows: Baris[]; posisi: { minggu: number; hari: number } | null; onBuka: (minggu: number, hari: number) => void }) {
  const pakai = new Map<number, number>()
  for (const r of rows) pakai.set(r.rayon, (pakai.get(r.rayon) || 0) + 1)
  const ganda = [...pakai].filter(([, n]) => n > 1).map(([r]) => r).sort((a, b) => a - b)
  const terpakai = pakai.size, kosong = MINGGU.reduce((a, m) => a + 6 - hariTerisi(rows, m), 0)
  return (
    <section className="sc-sum" aria-label="Ringkasan 4 minggu">
      <p className="sc-sum-info"><b>{terpakai}</b> dari 24 rayon terjadwal · <b>{kosong}</b> hari masih kosong
        {ganda.length > 0 && <> · <span className="sc-warn">dipakai lebih dari sekali: {ganda.map(kodeRayon).join(', ')}</span></>}</p>
      <div className="sc-sum-wrap">
        <table className="sc-mx">
          <thead><tr><th scope="col"><span className="sr-only">Minggu</span></th>{HARI.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
          <tbody>{MINGGU.map(m => <tr key={m}>
            <th scope="row">Minggu {m}<small>{hariTerisi(rows, m)}/6 hari</small></th>
            {HARI.map((h, i) => {
              const rs = rows.filter(x => x.minggu === m && x.hari === i + 1).sort((a, b) => a.rayon - b.rayon), ini = posisi?.minggu === m && posisi.hari === i + 1
              return <td key={h}><button type="button" className={`sc-cell ${rs.length ? '' : 'kosong'} ${ini ? 'today' : ''}`} onClick={() => onBuka(m, i + 1)}
                aria-label={`Buka ${h} Minggu ke ${m}${rs.length ? `, rayon ${rs.map(x => kodeRayon(x.rayon)).join(', ')}` : ', belum ada rayon'}`}>
                {rs.length ? rs.map(x => <b key={x.id}>{kodeRayon(x.rayon)}</b>) : <span>—</span>}{ini && <i className="sc-dot" aria-hidden="true" />}</button></td>
            })}</tr>)}</tbody>
        </table>
      </div>
    </section>)
}
