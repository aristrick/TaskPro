'use client'
import BottomSheet from '../ui/BottomSheet'
import { kodeRayon } from '../../lib/jadwal'

// Pemilih rayon di bagian bawah layar: kisi R01 sampai R24 yang mudah dijangkau jempol.
// Rayon jadwal hari ini diberi titik, dan tiap rayon yang sudah dikunjungi menampilkan jumlahnya.
export default function RayonSheet({ rayon, jadwal, perRayon, onPilih, onClose }: { rayon: number; jadwal: number[]; perRayon: Record<number, number>; onPilih: (r: number) => void; onClose: () => void }) {
  return <BottomSheet judul="Pilih rayon" onClose={onClose}>
    <div className="rayongrid" role="listbox" aria-label="Rayon">
      {Array.from({ length: 24 }, (_, i) => i + 1).map(r => {
        const hari = jadwal.includes(r), n = perRayon[r] || 0
        return <button key={r} type="button" role="option" aria-selected={r === rayon} className={`rayoncell ${r === rayon ? 'on' : ''}`} onClick={() => { onPilih(r); onClose() }}>
          <b>{kodeRayon(r)}</b>
          <small>{n > 0 ? `${n} dikunjungi` : hari ? 'Jadwal' : '\u00A0'}</small>
          {hari && <i className="rayondot" aria-label="Jadwal hari ini" />}
        </button>
      })}
    </div>
    {jadwal.length > 0 && <p className="rayonlegend"><i className="rayondot" aria-hidden="true" /> Rayon jadwal hari ini</p>}
  </BottomSheet>
}
