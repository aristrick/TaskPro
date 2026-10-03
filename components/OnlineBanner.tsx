'use client'
import { useEffect, useState } from 'react'
import Icon from './Icon'
// Peringatan saat HP kehilangan sinyal, agar frontliner tahu mengapa tombol gagal (isian tetap aman sebagai draf).
export default function OnlineBanner() {
  const [off, setOff] = useState(false)
  useEffect(() => {
    const u = () => setOff(!navigator.onLine); u()
    window.addEventListener('online', u); window.addEventListener('offline', u)
    return () => { window.removeEventListener('online', u); window.removeEventListener('offline', u) }
  }, [])
  if (!off) return null
  return <div className="offbar" role="status"><Icon name="alert" size={16} /> Tidak ada koneksi internet. Aksi akan gagal sampai sinyal kembali.</div>
}
