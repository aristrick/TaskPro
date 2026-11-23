'use client'
import { useEffect, useState } from 'react'
import { PageLoader } from './Loaders'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { loadMe, cachedMe } from '../lib/auth'
import { logout, keluarLokal, useHeartbeat } from '../lib/sesi'
import { useDialog } from './Dialog'
import Icon from './Icon'
import InaktifGuard from './InaktifGuard'
import { Logo } from './Logo'
import BottomSheet from './ui/BottomSheet'
import { KUNCI_INFO, perluInaktif } from '../lib/inaktif'

const ALL = ['mds', 'mdm', 'rmdm', 'tl', 'kormot'], ADM = ['mds', 'mdm', 'rmdm']
type Item = [string, string, string[], string]
// Menu dikelompokkan: Operasional (kerja harian), Data (master), Pengaturan.
const GRUP: { judul: string; item: Item[] }[] = [
  { judul: 'Operasional', item: [['/', 'Home', ALL, 'home'], ['/schedule', 'Schedule', ADM, 'calendar'], ['/project', 'Project', ADM, 'folder'], ['/stok', 'Stok', ALL, 'basket'], ['/report', 'Report', ALL, 'chart'], ['/pantau', 'Pantau', ALL, 'alert']] },
  { judul: 'Tracking Go', item: [['/tracking/backtrack', 'Back Tracking', ALL, 'locate'], ['/tracking/otj', 'OTJ', ALL, 'list'], ['/tracking/riwayat', 'Riwayat', ALL, 'receipt']] },
  { judul: 'Data', item: [['/frontliner', 'Frontliner', ADM, 'users'], ['/outlet', 'Outlet', ALL, 'store'], ['/produk', 'Produk', ADM, 'box']] },
  { judul: 'Pengaturan', item: [['/cabang', 'Cabang', ['mdm', 'rmdm'], 'building'], ['/mds', 'MDS & RMDM', ['mdm', 'rmdm'], 'shield'], ['/penjualan', 'Edit Penjualan', ['mdm'], 'edit'], ['/pengaturan', 'Aturan & Sistem', ALL, 'settings']] },
]

// Menu bawah di HP: empat pintasan utama (urutan prioritas, diambil yang boleh diakses role ini) + tombol Menu untuk sisanya.
const PRIMER = ['/', '/schedule', '/report', '/outlet', '/pantau']

export default function Shell({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const router = useRouter(), path = usePathname(), dlg = useDialog()
  const [me, setMe] = useState<any>(cachedMe())
  const [gpsOff, setGpsOff] = useState(false)
  const [menu, setMenu] = useState(false)
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
  // Akun admin yang tidak beraktivitas 30 menit keluar otomatis; halaman login menjelaskan alasannya.
  async function habisInaktif() {
    try { localStorage.setItem(KUNCI_INFO, 'inaktif') } catch { /* abaikan */ }
    await logout(); router.replace('/login')
  }
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
  const inisial = (me.nama || '?').trim().split(/\s+/).slice(0, 2).map((x: string) => x[0]).join('').toUpperCase()
  const semua = GRUP.flatMap(g => g.item).filter(x => x[2].includes(me.role))
  const utama = PRIMER.map(h => semua.find(x => x[0] === h)).filter((x): x is Item => !!x).slice(0, 4)
  const diMenu = !utama.some(x => on(x[0]))   // halaman aktif ada di dalam Menu → tombol Menu ikut menyala
  return (
    <div className="shell">
      {perluInaktif(me.role) && <InaktifGuard onHabis={habisInaktif} />}
      <header className="mtop">
        <h1><Logo /></h1>
        <button type="button" className="mtop-av" onClick={() => setMenu(true)} aria-label="Buka menu akun"><span className="avatar-i" aria-hidden="true">{inisial}</span></button>
      </header>
      <nav>
        <h1><Logo /></h1>
        <div className="navscroll">
          {GRUP.map(g => { const it = g.item.filter(x => x[2].includes(me.role)); return it.length ? <div className="navgrup" key={g.judul}><small className="sep">{g.judul}</small>{it.map(link)}</div> : null })}
        </div>
        <div className="navuser">
          <span className="avatar-i" aria-hidden="true">{(me.nama || '?').trim().split(/\s+/).slice(0, 2).map((x: string) => x[0]).join('').toUpperCase()}</span>
          <span className="navuser-t"><b>{me.nama}</b><small>{me.role.toUpperCase()}<span className="onl"><i />Aktif</span></small></span>
          <button className="ghost iconbtn" onClick={keluar} aria-label="Log out" title="Log out"><Icon name="logout" size={18} /></button>
        </div>
      </nav>
      <main><div className="page" key={path}>
        {gpsOff && <p className="notice">Lokasi belum aktif. Aplikasi tetap bisa dipakai, tetapi mengaktifkan lokasi membuat akun Anda lebih aman.</p>}
        {children}</div></main>
      <div className="mtab" role="navigation" aria-label="Menu utama">
        {utama.map(([h, t, , ic]) => <Link key={h} href={h} className={on(h) ? 'on' : ''} aria-current={on(h) ? 'page' : undefined}><span className="pill"><Icon name={ic} size={22} /></span>{t}</Link>)}
        <button type="button" className={diMenu ? 'on' : ''} onClick={() => setMenu(true)} aria-haspopup="dialog"><span className="pill"><Icon name="list" size={22} /></span>Menu</button>
      </div>
      {menu && <BottomSheet judul="Menu" onClose={() => setMenu(false)}>
        <div className="mmenu-user">
          <span className="avatar-i" aria-hidden="true">{inisial}</span>
          <span className="navuser-t"><b>{me.nama}</b><small>{me.role.toUpperCase()}<span className="onl"><i />Aktif</span></small></span>
          <button type="button" className="ghost iconbtn" onClick={() => { setMenu(false); keluar() }} aria-label="Log out"><Icon name="logout" size={20} /></button>
        </div>
        {GRUP.map(g => { const it = g.item.filter(x => x[2].includes(me.role)); return it.length ? <section className="mmenu-grup" key={g.judul}><h4>{g.judul}</h4>
          <div className="mmenu-grid">{it.map(([h, t, , ic]) => <Link key={h} href={h} onClick={() => setMenu(false)} className={on(h) ? 'on' : ''} aria-current={on(h) ? 'page' : undefined}><span className="mico"><Icon name={ic} size={22} /></span>{t}</Link>)}</div></section> : null })}
      </BottomSheet>}
    </div>
  )
}
