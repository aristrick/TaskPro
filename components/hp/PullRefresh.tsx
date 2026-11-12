'use client'
import { useEffect, useRef, useState } from 'react'
import Icon from '../Icon'

// Tarik-untuk-segarkan di bagian atas daftar. Pengganti tombol refresh di pojok kanan atas yang jauh dari jempol.
// Hanya aktif saat halaman sudah di posisi paling atas; indikatornya bergerak dengan transform agar ringan.
export default function PullRefresh({ onRefresh, aktif = true }: { onRefresh: () => void | Promise<void>; aktif?: boolean }) {
  const [tarik, setTarik] = useState(0), [muat, setMuat] = useState(false)
  const y0 = useRef<number | null>(null), ref = useRef(onRefresh); ref.current = onRefresh
  useEffect(() => {
    if (!aktif) return
    const awal = (e: TouchEvent) => { y0.current = window.scrollY <= 0 ? e.touches[0].clientY : null }
    const gerak = (e: TouchEvent) => { if (y0.current == null) return; const d = e.touches[0].clientY - y0.current; setTarik(d > 0 ? Math.min(90, d * 0.5) : 0) }
    const akhir = async () => {
      const d = tarik; y0.current = null
      if (d >= 56) { setMuat(true); setTarik(48); try { await ref.current() } finally { setTimeout(() => { setMuat(false); setTarik(0) }, 500) } } else setTarik(0)
    }
    window.addEventListener('touchstart', awal, { passive: true }); window.addEventListener('touchmove', gerak, { passive: true }); window.addEventListener('touchend', akhir)
    return () => { window.removeEventListener('touchstart', awal); window.removeEventListener('touchmove', gerak); window.removeEventListener('touchend', akhir) }
  }, [aktif, tarik])
  if (!tarik && !muat) return null
  return <div className="ptr" aria-hidden="true" style={{ transform: `translate(-50%, ${tarik}px)`, opacity: Math.min(1, tarik / 48) }}><Icon name="refresh" size={20} className={muat ? 'spin-loop' : ''} /></div>
}
