'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

// Pesan singkat dengan tombol "Urungkan" untuk aksi yang bisa dibalik (mengeluarkan anggota, melepas fokus, melepas cabang).
// Lebih ringan dan lebih ramah daripada dialog konfirmasi untuk aksi yang memang bisa dikembalikan. Hilang sendiri setelah 8 detik.
export function useUndo() {
  const [t, setT] = useState<{ pesan: string; balik: () => unknown } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const tutup = useCallback(() => { clearTimeout(timer.current); setT(null) }, [])
  const tampil = useCallback((pesan: string, balik: () => unknown) => { clearTimeout(timer.current); setT({ pesan, balik }); timer.current = setTimeout(() => setT(null), 8000) }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  const node = t ? <div className="undo-toast" role="status">
    <span>{t.pesan}</span>
    <button type="button" className="undo-btn" onClick={async () => { const b = t.balik; tutup(); await b() }}>Urungkan</button>
    <button type="button" className="undo-x" aria-label="Tutup pesan" onClick={tutup}>×</button></div> : null
  return { node, tampil }
}
