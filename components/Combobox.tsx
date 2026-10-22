'use client'
import { useId, useMemo, useState, type KeyboardEvent } from 'react'

export type Opsi = { value: string; label: string; sub?: string }
// Saring pilihan berdasarkan teks yang diketik (tanpa membedakan huruf besar/kecil, mencari di judul dan keterangan).
export const saring = (opsi: Opsi[], q: string, maks = 100): Opsi[] => {
  const k = q.trim().toLowerCase()
  return (k ? opsi.filter(o => `${o.label} ${o.sub || ''}`.toLowerCase().includes(k)) : opsi).slice(0, maks)
}

// Kolom "+ Tambah …" yang bisa diketik untuk mencari. Pengganti <select> saat pilihannya puluhan.
// Papan ketik: panah atas/bawah memilih, Enter menambahkan, Esc menutup. Dibaca pembaca layar sebagai combobox.
export default function Combobox({ label, placeholder, opsi, onPilih, kosong = 'Tidak ada hasil' }: { label: string; placeholder: string; opsi: Opsi[]; onPilih: (value: string) => void; kosong?: string }) {
  const id = useId()
  const [q, setQ] = useState(''), [buka, setBuka] = useState(false), [aktif, setAktif] = useState(0)
  const hasil = useMemo(() => saring(opsi, q), [opsi, q])
  const pilih = (o: Opsi) => { setQ(''); setBuka(false); setAktif(0); onPilih(o.value) }
  const tombol = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setBuka(true); setAktif(i => Math.min(hasil.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAktif(i => Math.max(0, i - 1)) }
    else if (e.key === 'Enter' && buka && hasil[aktif]) { e.preventDefault(); pilih(hasil[aktif]) }
    else if (e.key === 'Escape') setBuka(false)
  }
  return (
    <div className="cbx">
      <input role="combobox" className="addrow" aria-label={label} aria-expanded={buka} aria-controls={`${id}-daftar`} aria-autocomplete="list" autoComplete="off"
        aria-activedescendant={buka && hasil[aktif] ? `${id}-${aktif}` : undefined} placeholder={placeholder} value={q}
        onChange={e => { setQ(e.target.value); setBuka(true); setAktif(0) }} onFocus={() => setBuka(true)} onBlur={() => setBuka(false)} onKeyDown={tombol} />
      {buka && <ul id={`${id}-daftar`} role="listbox" aria-label={label} className="cbx-list">
        {hasil.length > 0
          ? hasil.map((o, i) => <li key={o.value} id={`${id}-${i}`} role="option" aria-selected={i === aktif} className={i === aktif ? 'on' : undefined}
              onPointerDown={e => { e.preventDefault(); pilih(o) }} onMouseEnter={() => setAktif(i)}><b>{o.label}</b>{o.sub && <small>{o.sub}</small>}</li>)
          : <li className="cbx-empty" role="option" aria-disabled="true" aria-selected="false">{kosong}</li>}
      </ul>}
    </div>)
}
