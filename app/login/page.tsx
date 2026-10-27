'use client'
import { useEffect, useState } from 'react'
import { PageLoader } from '../../components/Loaders'
import { useRouter } from 'next/navigation'
import { supabase, toEmail } from '../../lib/supabase'
import { klaim } from '../../lib/sesi'
import { clearMe } from '../../lib/auth'
import { Logo } from '../../components/Logo'
import { BATAS_MENIT, KUNCI_AKTIF, KUNCI_INFO } from '../../lib/inaktif'

export default function Login() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(true)
  const [info, setInfo] = useState('')   // alasan dikeluarkan otomatis (tidak ada aktivitas)
  useEffect(() => { try { if (localStorage.getItem(KUNCI_INFO)) { setInfo(`Anda keluar otomatis karena tidak ada aktivitas selama ${BATAS_MENIT} menit. Silakan login lagi.`); localStorage.removeItem(KUNCI_INFO) } } catch { /* abaikan */ } }, [])
  // Sudah punya sesi (mis. setelah refresh): langsung masuk, tidak perlu login ulang.
  useEffect(() => { supabase.auth.getSession().then(({ data }) => { if (data.session) router.replace('/'); else setChecking(false) }) }, [router])
  async function submit() {
    setBusy(true); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email: toEmail(userId), password })
    if (error) { setBusy(false); return setErr(error.message.includes('Invalid') ? 'User ID atau password salah.' : error.message) }
    const m = await klaim()   // frontliner ditolak jika akunnya aktif di perangkat lain
    if (m) { await supabase.auth.signOut({ scope: 'local' }); clearMe(); setBusy(false); return setErr(m) }
    try { localStorage.setItem(KUNCI_AKTIF, String(Date.now())) } catch { /* abaikan */ }   // sesi baru dimulai: hitungan tidak aktif mulai dari nol
    router.replace('/')
  }
  if (checking) return <PageLoader text="Memuat…" />
  return (
    <div className="login-bg">
      <div className="login">
        <h1><Logo /></h1>
        <p className="sub muted">Masuk ke akun Anda</p>
        <label className="fld"><span className="label">User ID</span>
          <input value={userId} autoComplete="username" autoCapitalize="none" autoCorrect="off" onChange={e => setUserId(e.target.value)} /></label>
        <label className="fld"><span className="label">Password</span>
          <input type="password" value={password} autoComplete="current-password"
            onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && userId && password && submit()} /></label>
        {info && !err && <p className="notice warn" role="status" style={{ margin: 0 }}>{info}</p>}
        {err && <p className="err" role="alert" style={{ margin: 0 }}>{err}</p>}
        <button onClick={submit} aria-busy={busy} disabled={busy || !userId || !password}>{busy ? 'Memproses…' : 'Login'}</button>
      </div>
    </div>
  )
}
