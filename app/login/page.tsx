'use client'
import { useEffect, useState } from 'react'
import Icon from '../../components/Icon'
import { PageLoader } from '../../components/Loaders'
import { useRouter } from 'next/navigation'
import { supabase, toEmail } from '../../lib/supabase'
import { klaim } from '../../lib/sesi'
import { clearMe } from '../../lib/auth'

export default function Login() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(true)
  // Sudah punya sesi (mis. setelah refresh): langsung masuk, tidak perlu login ulang.
  useEffect(() => { supabase.auth.getSession().then(({ data }) => { if (data.session) router.replace('/'); else setChecking(false) }) }, [router])
  async function submit() {
    setBusy(true); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email: toEmail(userId), password })
    if (error) { setBusy(false); return setErr(error.message.includes('Invalid') ? 'User ID atau password salah.' : error.message) }
    const m = await klaim()   // frontliner ditolak jika akunnya aktif di perangkat lain
    if (m) { await supabase.auth.signOut({ scope: 'local' }); clearMe(); setBusy(false); return setErr(m) }
    router.replace('/')
  }
  if (checking) return <PageLoader text="Memuat…" />
  return (
    <div className="login-bg">
      <div className="login">
        <div className="logo" aria-hidden="true"><Icon name="check" size={30} /></div>
        <h1>TaskPro</h1>
        <p className="sub muted">Masuk ke akun Anda</p>
        <label className="fld"><span className="label">User ID</span>
          <input value={userId} autoComplete="username" autoCapitalize="none" autoCorrect="off" onChange={e => setUserId(e.target.value)} /></label>
        <label className="fld"><span className="label">Password</span>
          <input type="password" value={password} autoComplete="current-password"
            onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && userId && password && submit()} /></label>
        {err && <p className="err" role="alert" style={{ margin: 0 }}>{err}</p>}
        <button onClick={submit} aria-busy={busy} disabled={busy || !userId || !password}>{busy ? 'Memproses…' : 'Login'}</button>
      </div>
    </div>
  )
}
