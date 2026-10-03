'use client'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { isNetworkError } from '../lib/friendly'
// Mencatat error aplikasi ke database sendiri (tanpa layanan pihak ketiga; hemat kuota paket gratis). Maksimal 5 per muat halaman.
export default function ErrorReporter() {
  useEffect(() => {
    let n = 0
    const kirim = (pesan: string, stack?: string) => {
      if (n >= 5 || !pesan || /ResizeObserver|Script error/i.test(pesan) || isNetworkError(pesan)) return
      n++; supabase.rpc('log_error', { p_pesan: pesan, p_stack: stack || '', p_url: location.pathname, p_ua: navigator.userAgent }).then(() => {}, () => {})
    }
    const a = (e: ErrorEvent) => kirim(e.message, e.error?.stack)
    const b = (e: PromiseRejectionEvent) => kirim(String(e.reason?.message || e.reason), e.reason?.stack)
    window.addEventListener('error', a); window.addEventListener('unhandledrejection', b)
    return () => { window.removeEventListener('error', a); window.removeEventListener('unhandledrejection', b) }
  }, [])
  return null
}
