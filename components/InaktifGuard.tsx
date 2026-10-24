'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { BATAS_MENIT, KUNCI_AKTIF, statusInaktif } from '../lib/inaktif'

const mmss = (d: number) => `${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}`
const baca = () => { try { const v = Number(localStorage.getItem(KUNCI_AKTIF)); return v > 0 ? v : Date.now() } catch { return Date.now() } }
const tulis = () => { try { localStorage.setItem(KUNCI_AKTIF, String(Date.now())) } catch { /* abaikan */ } }

// Memantau aktivitas (klik, ketik, gulir, sentuh). Satu menit sebelum batas muncul peringatan dengan hitung mundur dan tombol "Tetap masuk".
// Setelah batas, onHabis dipanggil sekali. Waktu aktivitas disimpan di localStorage: tab lain ikut terbaca, dan sesi yang tersimpan lalu dibuka
// kembali setelah lama (mis. laptop dibiarkan semalam) langsung dinyatakan habis.
export default function InaktifGuard({ onHabis }: { onHabis: () => void }) {
  const [sisa, setSisa] = useState<number | null>(null)
  const habis = useRef(false), cb = useRef(onHabis), terakhirTulis = useRef(0)
  cb.current = onHabis

  const cek = useCallback(() => {
    if (habis.current) return
    const s = statusInaktif(baca(), Date.now())
    if (s.status === 'habis') { habis.current = true; setSisa(null); cb.current(); return }
    setSisa(s.status === 'peringatan' ? s.sisaDetik : null)
  }, [])
  const lanjut = useCallback(() => { tulis(); setSisa(null) }, [])

  useEffect(() => {
    try { if (!localStorage.getItem(KUNCI_AKTIF)) tulis() } catch { /* abaikan */ }
    const aktivitas = (e: Event) => {
      if (habis.current || (e.target as Element | null)?.closest?.('[data-inaktif]')) return   // klik di dalam peringatan ditangani tombolnya sendiri
      if (statusInaktif(baca(), Date.now()).status === 'habis') return                       // sesudah batas lewat, aktivitas tidak menghidupkan sesi lagi
      const t = Date.now(); if (t - terakhirTulis.current > 2000) { terakhirTulis.current = t; tulis() }
      setSisa(s => (s === null ? s : null))
    }
    const ev = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const
    ev.forEach(n => window.addEventListener(n, aktivitas, { capture: true, passive: true }))
    const lihat = () => { if (document.visibilityState === 'visible') cek() }
    const gudang = (e: StorageEvent) => { if (e.key === KUNCI_AKTIF) cek() }
    document.addEventListener('visibilitychange', lihat); window.addEventListener('storage', gudang)
    const t = setInterval(cek, 1000); cek()
    return () => { ev.forEach(n => window.removeEventListener(n, aktivitas, { capture: true })); document.removeEventListener('visibilitychange', lihat); window.removeEventListener('storage', gudang); clearInterval(t) }
  }, [cek])

  if (sisa === null) return null
  return (
    <div className="overlay" data-inaktif>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="inaktif-t" aria-describedby="inaktif-d" data-inaktif>
        <div className="dicon"><Icon name="lock" size={28} /></div>
        <h3 id="inaktif-t">Sesi akan berakhir</h3>
        <p id="inaktif-d">Tidak ada aktivitas selama hampir {BATAS_MENIT} menit. Demi keamanan, Anda akan keluar otomatis dalam <b>{mmss(sisa)}</b>.</p>
        <div className="dbtns"><button className="primary" autoFocus onClick={lanjut}>Tetap masuk</button></div>
      </div>
    </div>)
}
