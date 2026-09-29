'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import Icon from './Icon'

const ALL = ['mds', 'mdm', 'rmdm', 'tl', 'kormot'], ADM = ['mds', 'mdm', 'rmdm']
type Item = [string, string, string[], string]
const MAIN: Item[] = [['/', 'Home', ALL, 'home'], ['/frontliner', 'Frontliner', ADM, 'users'], ['/outlet', 'Outlet', ALL, 'store'], ['/report', 'Report', ALL, 'chart'], ['/produk', 'Produk', ADM, 'box']]
const ADMIN: Item[] = [['/cabang', 'Cabang', ['mdm', 'rmdm'], 'building'], ['/mds', 'MDS & RMDM', ['mdm', 'rmdm'], 'shield']]
let cachedMe: any = null   // profil disimpan agar pindah halaman terasa instan (tanpa layar "Memuat")

export default function Shell({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const router = useRouter(), path = usePathname()
  const [me, setMe] = useState<any>(cachedMe)
  const [gpsOff, setGpsOff] = useState(false)
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { cachedMe = null; return router.replace('/login') }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
      if (!p) { cachedMe = null; await supabase.auth.signOut(); return router.replace('/login') }
      if (!roles.includes(p.role) && p.role === 'mds') return router.replace('/')
      if (p.role === 'frontliner') return router.replace('/m')
      cachedMe = p; setMe(p)
      // Non-frontliner: lokasi diminta tetapi tidak memblokir (laptop mungkin tanpa GPS)
      navigator.geolocation?.getCurrentPosition(() => setGpsOff(false), () => setGpsOff(true), { timeout: 8000 })
    })
  }, [router])
  if (!me) return <p className="muted" style={{ padding: 24 }}>Memuat…</p>
  if (!roles.includes(me.role)) return <p className="muted" style={{ padding: 24 }}>Halaman ini tidak tersedia untuk role {me.role}.</p>
  const on = (h: string) => (h === '/' ? path === '/' : path.startsWith(h) || (h === '/outlet' && path === '/import'))
  const link = ([h, t, , ic]: Item) => <Link key={h} href={h} className={on(h) ? 'active' : ''} aria-current={on(h) ? 'page' : undefined}><Icon name={ic} size={20} />{t}</Link>
  return (
    <div className="shell">
      <nav>
        <h1>TaskPro</h1>
        {MAIN.filter(x => x[2].includes(me.role)).map(link)}
        {['mdm', 'rmdm'].includes(me.role) && <><small className="sep">Pengaturan</small>{ADMIN.map(link)}</>}
        <div className="grow" />
        <small>{me.nama}<br />{me.role.toUpperCase()}</small>
        <button onClick={async () => { cachedMe = null; await supabase.auth.signOut(); router.replace('/login') }}><Icon name="logout" size={18} /> Log out</button>
      </nav>
      <main><div className="page" key={path}>
        {gpsOff && <p className="notice">Lokasi belum aktif. Aplikasi tetap bisa dipakai, tetapi mengaktifkan lokasi membuat akun Anda lebih aman.</p>}
        {children}</div></main>
    </div>
  )
}
