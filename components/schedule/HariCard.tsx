'use client'
import { useState } from 'react'
import Icon from '../Icon'
import { labelRayon } from '../../lib/schedule'

export type OutletJadwal = { id: number; code: string | null; name: string; address: string | null; rayon: number }

// Satu hari dalam jadwal: rayon yang dikunjungi dan daftar outletnya (nama + Outlet ID). Daftar bisa dicari dan digulir karena satu rayon bisa 100+ outlet.
export default function HariCard({ judul, label, hariIni, rayon, outlets, bisaUbah, onPilih, onHapus }: {
  judul: string; label: string; hariIni: boolean; rayon: number | null; outlets: OutletJadwal[]; bisaUbah: boolean; onPilih: () => void; onHapus: () => void }) {
  const [q, setQ] = useState('')
  const t = q.trim().toLowerCase()
  const tampil = t ? outlets.filter(o => `${o.name} ${o.code ?? ''} ${o.address ?? ''}`.toLowerCase().includes(t)) : outlets
  return (
    <article className={`hari-card ${hariIni ? 'today' : ''}`} aria-label={label}>
      <header className="hari-h">
        <h4>{judul}</h4>
        {rayon !== null && <span className="rbadge" title="Jumlah outlet aktif di rayon ini">{outlets.length}</span>}
        {hariIni && <span className="chip-ini">Hari ini</span>}
        <span className="grow" />
        {bisaUbah && <button type="button" className="icon-btn" aria-label={rayon === null ? `Pilih rayon ${label}` : `Ganti rayon ${label}`} title={rayon === null ? 'Pilih rayon' : 'Ganti rayon'} onClick={onPilih}><Icon name={rayon === null ? 'plus' : 'edit'} size={18} /></button>}
      </header>
      {rayon === null
        ? <p className="projempty">Belum ada rayon untuk hari ini.</p>
        : <>
          <div className="rayon-chip"><b>{labelRayon(rayon)}</b><small>{outlets.length} outlet aktif</small>
            {bisaUbah && <button type="button" className="lrow-act" aria-label={`Hapus jadwal ${label}`} onClick={onHapus}><Icon name="trash" size={14} /> Hapus</button>}</div>
          {outlets.length === 0
            ? <p className="projempty">Belum ada outlet aktif di rayon ini untuk frontliner ini.</p>
            : <>
              <label className="searchbox"><Icon name="search" size={16} /><input aria-label={`Cari outlet di ${label}`} placeholder="Cari nama atau Outlet ID…" value={q} onChange={e => setQ(e.target.value)} /></label>
              <ul className="outlet-list" tabIndex={0} aria-label={`Daftar outlet ${label}`}>
                {tampil.map(o => <li key={o.id}><span className="onama"><b>{o.name}</b><span className="oid" title="Outlet ID">{o.code ?? o.id}</span></span>{o.address && <small>{o.address}</small>}</li>)}
                {tampil.length === 0 && <li className="muted">Tidak ada outlet yang cocok.</li>}
              </ul></>}
        </>}
    </article>)
}
