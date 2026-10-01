'use client'
import { useEffect, useState } from 'react'

// Garis loading tipis di atas layar: muncul otomatis jika ada permintaan jaringan yang berjalan lebih dari 0,2 detik.
// Denyut sesi (sesi_detak) tidak dihitung agar garis tidak berkedip tiap 45 detik.
export default function NetBar() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const orig = window.fetch; let n = 0; let t: any
    const refresh = () => { clearTimeout(t); if (n > 0) t = setTimeout(() => setOn(true), 200); else setOn(false) }
    window.fetch = (async (...a: Parameters<typeof fetch>) => {
      const u = typeof a[0] === 'string' ? a[0] : (a[0] as any)?.url || String(a[0])
      if (u.includes('sesi_detak')) return orig.apply(window, a)
      n++; refresh()
      try { return await orig.apply(window, a) } finally { n--; refresh() }
    }) as typeof fetch
    return () => { window.fetch = orig; clearTimeout(t) }
  }, [])
  return <div className={`netbar ${on ? 'on' : ''}`} aria-hidden="true" />
}
