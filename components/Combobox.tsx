'use client'
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { letakDaftar, TINGGI_MAKS, type Letak } from '../lib/letak'

export type Opsi = { value: string; label: string; sub?: string }
// Saring pilihan berdasarkan teks yang diketik (tanpa membedakan huruf besar/kecil, mencari di judul dan keterangan).
export const saring = (opsi: Opsi[], q: string, maks = 100): Opsi[] => {
  const k = q.trim().toLowerCase()
  return (k ? opsi.filter(o => `${o.label} ${o.sub || ''}`.toLowerCase().includes(k)) : opsi).slice(0, maks)
}

// Kolom "+ Tambah …" yang bisa diketik untuk mencari. Pengganti <select> saat pilihannya puluhan.
// Memilih lewat klik/ketukan (bukan saat jari menyentuh), jadi menggulir daftar dengan jari tidak ikut memilih item.
// Papan ketik: panah atas/bawah memilih, Enter menambahkan, Esc menutup. Dibaca pembaca layar sebagai combobox.
export default function Combobox({ label, placeholder, opsi, onPilih, kosong = 'Tidak ada hasil', kelas = '' }: { label: string; placeholder: string; opsi: Opsi[]; onPilih: (value: string) => void; kosong?: string; kelas?: string }) {
  const id = useId()
  const [q, setQ] = useState(''), [buka, setBuka] = useState(false), [aktif, setAktif] = useState(0)
  const hasil = useMemo(() => saring(opsi, q), [opsi, q])
  const kotak = useRef<HTMLDivElement>(null)
  const [letak, setLetak] = useState<Letak>({ naik: false, tinggi: TINGGI_MAKS })
  // Daftar membuka ke atas bila ruang di bawah kolom sempit (mis. kartu paling bawah di halaman), dan tingginya dibatasi ruang yang ada.
  // Tanpa ini daftar terpotong di tepi layar dan bagian bawahnya tidak bisa dijangkau.
  const ukur = useCallback(() => {
    const r = kotak.current?.getBoundingClientRect(); if (!r) return
    const vh = window.visualViewport?.height ?? window.innerHeight
    setLetak(l => { const n = letakDaftar(r.top, vh - r.bottom); return n.naik === l.naik && n.tinggi === l.tinggi ? l : n })
  }, [])
  useEffect(() => {
    if (!buka) return
    ukur()
    const vv = window.visualViewport   // papan ketik di HP mengecilkan visualViewport, bukan window
    window.addEventListener('resize', ukur); vv?.addEventListener('resize', ukur)
    return () => { window.removeEventListener('resize', ukur); vv?.removeEventListener('resize', ukur) }
  }, [buka, ukur])
  const pilih = (o: Opsi) => { setQ(''); setBuka(false); setAktif(0); onPilih(o.value) }
  const tombol = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setBuka(true); setAktif(i => Math.min(hasil.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAktif(i => Math.max(0, i - 1)) }
    else if (e.key === 'Enter' && buka && hasil[aktif]) { e.preventDefault(); pilih(hasil[aktif]) }
    else if (e.key === 'Escape') setBuka(false)
  }
  return (
    <div className="cbx" ref={kotak}>
      <input role="combobox" className={`addrow ${kelas}`.trim()} aria-label={label} aria-expanded={buka} aria-controls={`${id}-daftar`} aria-autocomplete="list" autoComplete="off"
        aria-activedescendant={buka && hasil[aktif] ? `${id}-${aktif}` : undefined} placeholder={placeholder} value={q}
        onChange={e => { setQ(e.target.value); setBuka(true); setAktif(0) }} onFocus={() => setBuka(true)} onBlur={() => setBuka(false)} onKeyDown={tombol} />
      {buka && <ul id={`${id}-daftar`} role="listbox" aria-label={label} className={`cbx-list ${letak.naik ? 'up' : ''}`} style={{ maxHeight: letak.tinggi }}
        onMouseDown={e => e.preventDefault()}>   {/* menyeret bilah gulir daftar tidak boleh memindahkan fokus dari kolom, kalau tidak daftar menutup */}
        {hasil.length > 0
          ? hasil.map((o, i) => <li key={o.value} id={`${id}-${i}`} role="option" aria-selected={i === aktif} className={i === aktif ? 'on' : undefined}
              onClick={() => pilih(o)} onMouseEnter={() => setAktif(i)}><b>{o.label}</b>{o.sub && <small>{o.sub}</small>}</li>)
          : <li className="cbx-empty" role="option" aria-disabled="true" aria-selected="false">{kosong}</li>}
      </ul>}
    </div>)
}
