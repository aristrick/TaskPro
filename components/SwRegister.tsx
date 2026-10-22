'use client'
import { useEffect } from 'react'
// Mendaftarkan service worker (public/sw.js) agar aplikasi bisa dipasang di layar HP dan halaman frontliner terbuka tanpa sinyal.
// Hanya di HTTPS (atau localhost untuk pengujian).
export default function SwRegister() {
  useEffect(() => { if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('/sw.js').catch(() => {}) }, [])
  return null
}
