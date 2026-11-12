'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'

// Sheet bawah ala One UI: ada pegangan, bisa digeser ke bawah untuk menutup, dan masuk dengan animasi pegas.
// Gerakan hanya memakai transform dan opacity agar tetap 60 fps di HP kelas menengah.
export default function BottomSheet({ judul, onClose, children }: { judul: string; onClose: () => void; children: ReactNode }) {
  const [keluar, setKeluar] = useState(false), [dy, setDy] = useState(0)
  const mulai = useRef<number | null>(null)
  const tutup = () => { setKeluar(true); setTimeout(onClose, 200) }
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && tutup()
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k)
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps
  return <div className={`bsheet-wrap ${keluar ? 'out' : ''}`} onClick={tutup}>
    <div className="bsheet" role="dialog" aria-modal="true" aria-label={judul} style={dy ? { transform: `translateY(${dy}px)`, transition: 'none' } : undefined} onClick={e => e.stopPropagation()}>
      <div className="bsheet-grab" onPointerDown={e => { mulai.current = e.clientY; (e.target as HTMLElement).setPointerCapture?.(e.pointerId) }}
        onPointerMove={e => { if (mulai.current != null) setDy(Math.max(0, e.clientY - mulai.current)) }}
        onPointerUp={() => { const d = dy; mulai.current = null; if (d > 90) tutup(); else setDy(0) }} onPointerCancel={() => { mulai.current = null; setDy(0) }}>
        <span className="bsheet-handle" aria-hidden="true" /></div>
      <h3 className="bsheet-title">{judul}</h3>
      <div className="bsheet-body">{children}</div>
    </div>
  </div>
}
