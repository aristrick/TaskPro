'use client'
import { useRef } from 'react'

// Pegangan di atas sheet (garis kecil). Geser ke bawah lebih dari 90 px untuk menutup; kurang dari itu sheet kembali dengan pegas.
export default function SwipeHandle({ onClose }: { onClose: () => void }) {
  const y0 = useRef<number | null>(null)
  const sheet = (e: React.PointerEvent) => (e.currentTarget as HTMLElement).parentElement as HTMLElement
  return <div className="grab" role="presentation"
    onPointerDown={e => { y0.current = e.clientY; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); sheet(e).style.transition = 'none' }}
    onPointerMove={e => { if (y0.current != null) sheet(e).style.transform = `translateY(${Math.max(0, e.clientY - y0.current)}px)` }}
    onPointerUp={e => { const d = y0.current == null ? 0 : e.clientY - y0.current; y0.current = null; const s = sheet(e); s.style.transition = ''; if (d > 90) onClose(); else s.style.transform = '' }}
    onPointerCancel={e => { y0.current = null; const s = sheet(e); s.style.transition = ''; s.style.transform = '' }}>
    <span className="bsheet-handle" aria-hidden="true" />
  </div>
}
