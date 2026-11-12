'use client'
import { useEffect, useRef, useState } from 'react'
import { n } from '../../lib/angka'

// Angka menghitung naik satu kali saat pertama tampil. Mengikuti pengaturan "kurangi gerakan".
export default function CountUp({ value, format = n }: { value: number; format?: (v: number) => string }) {
  const [v, setV] = useState(value), pernah = useRef(false)
  useEffect(() => {
    if (pernah.current || typeof window === 'undefined') { setV(value); return }
    pernah.current = true
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || value === 0) { setV(value); return }
    let raf = 0; const t0 = performance.now(), dur = 700
    const step = (t: number) => { const p = Math.min(1, (t - t0) / dur); setV(Math.round(value * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(step) }
    setV(0); raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{format(v)}</>
}
