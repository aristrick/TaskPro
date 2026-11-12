'use client'
import { useMemo, useState } from 'react'
import Icon from '../Icon'
import { HARI, kodeRayon, outletHari, type Baris, type OutletJadwal } from '../../lib/jadwal'

// Satu hari (mis. Senin Minggu ke 1): judul dan jumlah outlet, tombol + untuk memilih rayon, rayon terjadwal (chip, bisa dilepas),
// kolom cari, lalu daftar outlet milik rayon itu. Nama outlet diikuti Outlet ID-nya.
export default function DayCard({ minggu, hari, rayons, per, hariIni, bisaUbah, onTambah, onLepas }: {
  minggu: number; hari: number; rayons: Baris[]; per: Map<number, OutletJadwal[]>; hariIni: boolean; bisaUbah: boolean
  onTambah: () => void; onLepas: (b: Baris) => void }) {
  const [q, setQ] = useState('')
  const { total, tampil } = useMemo(() => outletHari(rayons.map(x => x.rayon), per, q), [rayons, per, q])
  const nama = HARI[hari - 1], banyakRayon = rayons.length > 1
  return (
    <article className={`sc-day ${hariIni ? 'today' : ''}`} aria-label={`${nama}, Minggu ke ${minggu}`}>
      <header className="sc-dh">
        <h4>{nama}<span className="cnt" aria-label={`${total} outlet`}>{total}</span>{hariIni && <span className="sc-now">Hari ini</span>}</h4>
        {bisaUbah && <button type="button" className="sc-add" aria-label={`Tambah rayon untuk ${nama} Minggu ke ${minggu}`} title="Tambah rayon" onClick={onTambah}><Icon name="plus" size={18} /></button>}
      </header>
      {rayons.length > 0
        ? <ul className="sc-chips" aria-label="Rayon terjadwal">{rayons.map(b => <li key={b.id} className="sc-chip"><b>{kodeRayon(b.rayon)}</b>
            {bisaUbah && <button type="button" aria-label={`Lepas ${kodeRayon(b.rayon)} dari ${nama} Minggu ke ${minggu}`} title="Lepas rayon" onClick={() => onLepas(b)}><Icon name="close" size={14} /></button>}</li>)}</ul>
        : <p className="sc-none">Belum ada rayon.{bisaUbah ? ' Tekan + untuk memilih rayon.' : ''}</p>}
      {total > 0 && <label className="sc-q"><span className="sr-only">Cari outlet hari {nama}</span><Icon name="search" size={16} />
        <input type="search" placeholder="Cari nama, ID, atau alamat" value={q} onChange={e => setQ(e.target.value)} /></label>}
      {rayons.length > 0 && total === 0 && <p className="sc-none">Rayon ini belum punya outlet untuk frontliner ini.</p>}
      {tampil.length > 0 && <ul className="sc-outlets">{tampil.map(o => <li key={o.id}>
        <div className="sc-on"><b>{o.name}</b>{o.ext_id && <span className="sc-oid" title="Outlet ID">{o.ext_id}</span>}{banyakRayon && o.rayon && <span className="sc-or">{kodeRayon(o.rayon)}</span>}</div>
        <small>{o.address}</small></li>)}</ul>}
      {total > 0 && tampil.length === 0 && <p className="sc-none">Tidak ada outlet yang cocok.</p>}
    </article>)
}
