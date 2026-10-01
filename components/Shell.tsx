'use client'
import { useEffect, useState } from 'react'
import { PageLoader } from './Loaders'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { loadMe, cachedMe } from '../lib/auth'
import { logout, keluarLokal, useHeartbeat } from '../lib/sesi'
import { useDialog } from './Dialog'
import Icon from './Icon'

const ALL = ['mds', 'mdm', 'rmdm', 'tl', 'kormot'], ADM = ['mds', 'mdm', 'rmdm']
type Item = [string, string, string[], string]
const MAIN: Item[] = [['/', 'Home', ALL, 'home'], ['/frontliner', 'Frontliner', ADM, 'users'], ['/project', 'Project', ADM, 'folder'], ['/outlet', 'Outlet', ALL, 'store'], ['/report', 'Report', ALL, 'chart'], ['/produk', 'Produk', ADM, 'box']]
const ADMIN: Item[] = [['/cabang', 'Cabang', ['mdm', 'rmdm'], 'building'], ['/mds', 'MDS & RMDM', ['mdm', 'rmdm'], 'shield']]

export default function Shell({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const router = useRouter(), path = usePathname(), dlg = useDialog()
  const [me, setMe] = useState<any>(cachedMe())
  const [gpsOff, setGpsOff] = useState(false)
  const [fail, setFail] = useState(''); const [tries, setTries] = useState(0)
  useEffect(() => {
    let off = false
    // Sesi dibaca dari penyimpanan lokal: refresh halaman tidak membuat logout. Ke halaman login hanya jika memang tidak ada sesi.
    loadMe().then(({ me: p, error }) => {
      if (off) return
      if (error) return setFail(error)
      if (!p) return router.replace('/login')
      if (p.role === 'frontliner') return router.replace('/m')
      if (!roles.includes(p.role) && p.role === 'mds') return router.replace('/')
      setFail(''); setMe(p)
      navigator.geolocation?.getCurrentPosition(() => setGpsOff(false), () => setGpsOff(true), { timeout: 8000 })
    })
    return () => { off = true }
  }, [router, tries])

  useHeartbeat(!!me, async () => {
    await dlg.alert({ title: 'Sesi berakhir', icon: 'logout', message: 'Akun Anda dikeluarkan karena sesinya diakhiri oleh admin atau login di perangkat lain.' })
    await keluarLokal(); router.replace('/login')
  })
  async function keluar() {
    const ya = await dlg.confirm({ title: 'Keluar dari akun?', icon: 'logout', tone: 'danger', okText: 'Log out', message: 'Anda perlu login lagi untuk memakai TaskPro di perangkat ini.' })
    if (!ya) return
    await logout(); router.replace('/login')
  }

  if (fail) return <div className="gate"><h2>Gagal memuat akun</h2><p className="muted">{fail}</p>
    <button onClick={() => setTries(t => t + 1)}>Coba lagi</button><button className="ghost" onClick={keluar}><Icon name="logout" size={18} /> Log out</button></div>
  if (!me) return <PageLoader text="Memuat TaskPro…" />
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
        <small>{me.nama}<br />{me.role.toUpperCase()}<span className="onl"><i />Aktif</span></small>
        <button onClick={keluar}><Icon name="logout" size={18} /> Log out</button>
      </nav>
      <main><div className="page" key={path}>
        {gpsOff && <p className="notice">Lokasi belum aktif. Aplikasi tetap bisa dipakai, tetapi mengaktifkan lokasi membuat akun Anda lebih aman.</p>}
        {children}</div></main>
    </div>
  )
}
