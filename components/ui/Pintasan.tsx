'use client'
import { pintasanAktif, rentang, type Pintasan } from '../../lib/angka'

// Pintasan "Hari ini · 7 hari · Bulan ini" untuk rentang tanggal. Lebih cepat daripada membuka kalender bawaan browser.
export default function PintasanTanggal({ dari, sampai, onPilih }: { dari: string; sampai?: string; onPilih: (dari: string, sampai: string) => void }) {
  const s = sampai ?? dari, aktif = pintasanAktif(dari, s)
  const item: [Pintasan, string][] = [['hari', 'Hari ini'], ['tujuh', '7 hari'], ['bulan', 'Bulan ini']]
  return <div className="seg" role="group" aria-label="Pintasan tanggal">
    {item.map(([k, t]) => <button key={k} type="button" className={aktif === k ? 'on' : ''} aria-pressed={aktif === k} onClick={() => { const r = rentang(k); onPilih(r.dari, r.sampai) }}>{t}</button>)}
  </div>
}
