'use client'
import { useState } from 'react'
import { ketikQty } from '../../lib/qty'

// Kolom jumlah yang bisa diketik bebas ("20", "02", kosongkan lalu ketik ulang). Teks yang sedang diketik disimpan di sini;
// jumlah resmi baru berubah saat ada angka, dan saat kolom ditinggalkan tampilannya kembali rapi (02 menjadi 2, kosong kembali ke jumlah sebelumnya).
export default function QtyInput({ nilai, maks, label, onUbah, onFokus, onSelesai }: { nilai: number; maks: number; label: string; onUbah: (n: number) => void; onFokus: () => void; onSelesai: () => void }) {
  const [teks, setTeks] = useState<string | null>(null)   // null = tidak sedang diketik
  return (
    <input inputMode="numeric" aria-label={label} value={teks ?? String(nilai)}
      onFocus={e => { setTeks(String(nilai)); e.target.select(); onFokus() }}
      onChange={e => { const r = ketikQty(e.target.value, maks); setTeks(r.teks); if (r.nilai !== null) onUbah(r.nilai) }}
      onBlur={() => { setTeks(null); onSelesai() }} />)
}
