'use client'
import { useEffect, type ReactNode } from 'react'
import Icon from '../Icon'

// Panel samping untuk formulir tambah/ubah. Daftar tetap jadi fokus halaman; formulir muncul hanya saat dibutuhkan.
export default function SidePanel({ judul, onClose, children }: { judul: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k)
  }, [onClose])
  // Selama panel terbuka, halaman di belakangnya (daftar) dikunci: hanya isi panel yang bisa di-scroll
  useEffect(() => {
    const h = document.documentElement, lama = { o: h.style.overflow, p: h.style.paddingRight }
    const lebar = window.innerWidth - h.clientWidth
    h.style.overflow = 'hidden'; if (lebar > 0) h.style.paddingRight = lebar + 'px'
    return () => { h.style.overflow = lama.o; h.style.paddingRight = lama.p }
  }, [])
  return <div className="sidepanel-wrap" onClick={onClose}>
    <aside className="sidepanel" role="dialog" aria-modal="true" aria-label={judul} onClick={e => e.stopPropagation()}>
      <header><h3>{judul}</h3><button type="button" className="ghost iconbtn" aria-label="Tutup panel" onClick={onClose}><Icon name="close" size={18} /></button></header>
      <div className="sidepanel-body">{children}</div>
    </aside>
  </div>
}
