'use client'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { supabase.rpc('log_error', { p_pesan: error.message, p_stack: error.stack || '', p_url: location.pathname, p_ua: navigator.userAgent }).then(() => {}, () => {}) }, [error])
  return <div className="gate"><h2>Terjadi kesalahan</h2><p className="muted">Halaman gagal ditampilkan. Data Anda aman. Coba muat ulang.</p><button onClick={reset}>Muat ulang</button></div>
}
