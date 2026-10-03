'use client'
import { useEffect } from 'react'
// Service worker minimal (tanpa cache) hanya agar aplikasi bisa dipasang di layar HP; tidak ada risiko versi lama tersangkut.
export default function SwRegister() {
  useEffect(() => { if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {}) }, [])
  return null
}
