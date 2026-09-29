'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, toEmail } from '../../lib/supabase'

export default function Login() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit() {
    setBusy(true); setErr('')
    const { data, error } = await supabase.auth.signInWithPassword({ email: toEmail(userId), password })
    if (error) { setBusy(false); return setErr(error.message.includes('Invalid') ? 'User ID atau password salah.' : error.message) }
    router.replace('/')
  }
  return (
    <div className="login">
      <h1>TaskPro</h1>
      <p className="sub muted">Masuk dengan User ID Anda</p>
      <input placeholder="User ID (contoh 0300-TMTB01)" value={userId} autoComplete="username" autoCapitalize="none"
        onChange={e => setUserId(e.target.value)} />
      <input placeholder="Password" type="password" value={password} autoComplete="current-password"
        onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
      {err && <p className="err" role="alert" style={{ margin: 0 }}>{err}</p>}
      <button onClick={submit} disabled={busy || !userId || !password}>{busy ? 'Memproses…' : 'Login'}</button>
    </div>
  )
}
