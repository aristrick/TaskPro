'use client'
import { useEffect, useRef } from 'react'
import Icon from '../Icon'
import { RAYON, kodeRayon, labelHari, letakRayon, type Baris } from '../../lib/jadwal'

// Pilih rayon untuk satu hari: 24 tombol R01–R24 beserta jumlah outlet. Rayon yang sudah ada di hari ini dinonaktifkan;
// rayon yang sudah dipakai di hari lain tetap boleh dipilih, tetapi diberi petunjuk.
// Memakai gaya dialog aplikasi (overlay/dialog) agar tampil dan bekerja sama: Esc menutup, fokus tidak keluar dari kotak.
export default function RayonPicker({ minggu, hari, rows, jumlah, onPilih, onTutup }: {
  minggu: number; hari: number; rows: Baris[]; jumlah: Map<number, number>; onPilih: (rayon: number) => void; onTutup: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  const kembali = useRef<Element | null>(null)
  const dihari = new Set(rows.filter(x => x.minggu === minggu && x.hari === hari).map(x => x.rayon))
  useEffect(() => {
    kembali.current = document.activeElement
    box.current?.querySelector<HTMLElement>('button.rp:not(:disabled)')?.focus()
    return () => { (kembali.current as HTMLElement | null)?.focus?.() }
  }, [])
  function tombol(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.stopPropagation(); onTutup() }
    else if (e.key === 'Tab') {
      const f = Array.from(box.current!.querySelectorAll<HTMLElement>('button')).filter(x => !(x as HTMLButtonElement).disabled)
      if (!f.length) return
      const a = f[0], z = f[f.length - 1]
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
    }
  }
  return (
    <div className="overlay" onMouseDown={e => e.target === e.currentTarget && onTutup()} onKeyDown={tombol}>
      <div className="dialog left rpbox" role="dialog" aria-modal="true" aria-labelledby="rp-judul" ref={box}>
        <h3 id="rp-judul">Pilih rayon</h3>
        <p className="rpsub">{labelHari(minggu, hari)}. Rayon yang dipilih menjadi jadwal kunjungan frontliner pada hari ini.</p>
        <div className="rpgrid" role="group" aria-label="Daftar rayon">
          {RAYON.map(r => {
            const ada = dihari.has(r), lain = letakRayon(rows, r).filter(x => !(x.minggu === minggu && x.hari === hari))
            const n = jumlah.get(r) || 0
            const ket = ada ? 'sudah dijadwalkan di hari ini' : lain.length ? `sudah dipakai di ${lain.map(x => labelHari(x.minggu, x.hari)).join(', ')}` : ''
            return <button type="button" key={r} className={`rp ${lain.length ? 'dipakai' : ''}`} disabled={ada} title={ket || undefined}
              aria-label={`${kodeRayon(r)}, ${n} outlet${ket ? `, ${ket}` : ''}`} onClick={() => onPilih(r)}>
              <b>{ada ? <Icon name="check" size={14} /> : null}{kodeRayon(r)}</b><small>{n} outlet</small></button>
          })}
        </div>
        <p className="rpnote"><i className="rpdot" aria-hidden="true" /> Titik oranye = rayon ini sudah dijadwalkan di hari lain. Tetap boleh dipilih lagi.</p>
        <div className="dbtns"><button className="ghost" onClick={onTutup}>Tutup</button></div>
      </div>
    </div>)
}
