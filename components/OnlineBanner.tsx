'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Icon from './Icon'
// Peringatan saat HP kehilangan sinyal, agar frontliner tahu mengapa tombol gagal (isian tetap aman sebagai draf).
export default function OnlineBanner() {
  const [off, setOff] = useState(false)
  const frontliner = usePathname() === '/m'   // layar frontliner punya antrean kirim: check-out disimpan di HP dan dikirim saat sinyal kembali
  useEffect(() => {
    const u = () => setOff(!navigator.onLine); u()
    window.addEventListener('online', u); window.addEventListener('offline', u)
    return () => { window.removeEventListener('online', u); window.removeEventListener('offline', u) }
  }, [])
  if (!off) return null
  return <div className="offbar" role="status"><Icon name="alert" size={16} /> {frontliner ? 'Tidak ada koneksi internet. Isian tetap tersimpan; check-out dikirim otomatis saat sinyal kembali.' : 'Tidak ada koneksi internet. Aksi akan gagal sampai sinyal kembali.'}</div>
}
