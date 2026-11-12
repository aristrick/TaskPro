'use client'
import { useMemo, useState } from 'react'
import Icon from '../Icon'
import { HARI, kodeRayon, outletHari, ringkasRayon, type Baris, type OutletJadwal } from '../../lib/jadwal'

const HALAMAN = 30   // jumlah outlet yang tampil sekaligus; sisanya lewat tombol "Tampilkan lebih banyak"

// Satu minggu: enam ubin hari di atas (ringkas: rayon dan jumlah outlet), lalu rincian outlet HANYA untuk hari yang dipilih.
// Dengan begitu halaman tidak panjang, kolom cari hanya satu, dan alamat panjang punya ruang yang cukup.
export default function WeekBoard({ minggu, rows, per, posisi, hari, onHari, bisaUbah, onTambah, onLepas }: {
  minggu: number; rows: Baris[]; per: Map<number, OutletJadwal[]>; posisi: { minggu: number; hari: number } | null
  hari: number; onHari: (h: number) => void; bisaUbah: boolean; onTambah: (h: number) => void; onLepas: (b: Baris) => void }) {
  const dayRows = (h: number) => rows.filter(x => x.minggu === minggu && x.hari === h).sort((a, b) => a.rayon - b.rayon)
  return (<>
    <div className="sc-tiles" role="group" aria-label={`Hari pada Minggu ke ${minggu}`}>
      {HARI.map((nama, i) => {
        const h = i + 1, rs = dayRows(h), sel = h === hari, ini = posisi?.minggu === minggu && posisi.hari === h
        const n = outletHari(rs.map(x => x.rayon), per).total
        return (
          <article key={h} className={`sc-tile ${sel ? 'sel' : ''} ${ini ? 'today' : ''} ${rs.length ? '' : 'kosong'}`} aria-label={`${nama}, Minggu ke ${minggu}`}>
            <button type="button" className="sc-tile-main" aria-pressed={sel} onClick={() => onHari(h)}
              aria-label={`${nama}: ${rs.length ? ringkasRayon(rs.map(x => x.rayon)) : 'belum ada rayon'}, ${n} outlet. Lihat outlet`}>
              <span className="sc-tile-day">{nama}{ini && <span className="sc-now">Hari ini</span>}</span>
              <span className="sc-tile-n"><b>{n}</b> outlet</span>
            </button>
            {rs.length > 0
              ? <ul className="sc-chips" aria-label="Rayon terjadwal">{rs.map(b => <li key={b.id} className="sc-chip"><b>{kodeRayon(b.rayon)}</b>
                  {bisaUbah && <button type="button" aria-label={`Lepas ${kodeRayon(b.rayon)} dari ${nama} Minggu ke ${minggu}`} title="Lepas rayon" onClick={() => onLepas(b)}><Icon name="close" size={14} /></button>}</li>)}</ul>
              : <p className="sc-tile-empty">Belum ada rayon</p>}
            {bisaUbah && <button type="button" className="sc-tile-add" aria-label={`Tambah rayon untuk ${nama} Minggu ke ${minggu}`} onClick={() => onTambah(h)}><Icon name="plus" size={16} /> Rayon</button>}
          </article>)
      })}
    </div>
    <DayDetail key={`${minggu}-${hari}`} minggu={minggu} hari={hari} rs={dayRows(hari)} per={per} ini={posisi?.minggu === minggu && posisi.hari === hari} bisaUbah={bisaUbah} onTambah={() => onTambah(hari)} />
  </>)
}

function DayDetail({ minggu, hari, rs, per, ini, bisaUbah, onTambah }: { minggu: number; hari: number; rs: Baris[]; per: Map<number, OutletJadwal[]>; ini: boolean; bisaUbah: boolean; onTambah: () => void }) {
  const [q, setQ] = useState(''), [maks, setMaks] = useState(HALAMAN)
  const rayons = useMemo(() => rs.map(x => x.rayon), [rs])
  const { total, tampil } = useMemo(() => outletHari(rayons, per, q), [rayons, per, q])
  const nama = HARI[hari - 1], banyak = rayons.length > 1
  return (
    <section className="sc-detail" aria-label={`Outlet ${nama} Minggu ke ${minggu}`}>
      <header className="sc-detail-h">
        <div className="sc-detail-t">
          <h3>{nama}<span className="sc-sub">Minggu ke {minggu}</span>{ini && <span className="sc-now">Hari ini</span>}</h3>
          <p>{rayons.length ? <>Rayon <b>{ringkasRayon(rayons)}</b> · {total} outlet</> : 'Belum ada rayon pada hari ini'}</p>
        </div>
        {total > 0 && <label className="sc-q"><span className="sr-only">Cari outlet hari {nama}</span><Icon name="search" size={16} />
          <input type="search" placeholder="Cari nama, ID, atau alamat" value={q} onChange={e => { setQ(e.target.value); setMaks(HALAMAN) }} /></label>}
      </header>
      {rayons.length === 0 && <div className="sc-blank"><Icon name="calendar" size={28} /><b>Hari ini belum punya jadwal rayon</b>
        <p>{bisaUbah ? 'Pilih rayon yang dikunjungi frontliner pada hari ini.' : 'Jadwal belum diisi.'}</p>
        {bisaUbah && <button type="button" onClick={onTambah}><Icon name="plus" size={16} /> Pilih rayon</button>}</div>}
      {rayons.length > 0 && total === 0 && <div className="sc-blank"><Icon name="store" size={28} /><b>Rayon ini belum punya outlet</b><p>Belum ada outlet aktif untuk frontliner ini di rayon yang dipilih.</p></div>}
      {total > 0 && tampil.length === 0 && <div className="sc-blank"><Icon name="search" size={28} /><b>Tidak ada outlet yang cocok</b><p>Coba kata kunci lain atau hapus pencarian.</p></div>}
      {tampil.length > 0 && <>
        <ul className="sc-outlets">{tampil.slice(0, maks).map(o => <li key={o.id}>
          <div className="sc-on"><b>{o.name}</b>{o.ext_id && <span className="sc-oid" title="Outlet ID">{o.ext_id}</span>}{banyak && o.rayon && <span className="sc-or">{kodeRayon(o.rayon)}</span>}</div>
          <small title={o.address}>{o.address}</small></li>)}</ul>
        <div className="sc-more"><span>Menampilkan {Math.min(maks, tampil.length)} dari {tampil.length}{q.trim() ? ' hasil' : ' outlet'}</span>
          {tampil.length > maks && <button type="button" className="ghost small" onClick={() => setMaks(m => m + HALAMAN)}>Tampilkan lebih banyak</button>}</div></>}
    </section>)
}
