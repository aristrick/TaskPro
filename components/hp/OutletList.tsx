'use client'
import { useEffect, useState, type ReactNode } from 'react'
import Icon from '../Icon'
import OutletForm from '../OutletForm'
import { SkelRows } from '../Loaders'
import { useDialog } from '../Dialog'
import { buzz, fmt, meters } from '../../lib/hp'
import type { Me, Outlet, Posisi } from '../../lib/types'

type Baris = Outlet & { d: number | null }

// Tab "Input": judul, pencarian dan rayon, progres kunjungan, lalu daftar outlet (terdekat dulu). Mode Edit Outlet dan menu ada di sini.
export default function OutletList({ me, rayon, setRayon, rows, loading, visited, pos, getPos, busy, busyId, err, onMasuk, onReload, onToast, bar, luring }: {
  me: Me; rayon: number; setRayon: (r: number) => void; rows: Outlet[]; loading: boolean; visited: Set<number>; pos: Posisi | null; getPos: () => void
  busy: boolean; busyId: number | null; err: string; onMasuk: (r: Outlet) => void; onReload: (keep?: boolean) => void; onToast: (t: string) => void; bar?: ReactNode; luring?: boolean }) {
  const dlg = useDialog()
  const [q, setQ] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState<Outlet | 'new' | null>(null)
  const [menu, setMenu] = useState(false)
  const [closingMenu, setClosingMenu] = useState(false)
  const [spin, setSpin] = useState(false)
  const [savedId, setSavedId] = useState<number | null>(null)
  const closeMenu = () => { setClosingMenu(true); setTimeout(() => { setMenu(false); setClosingMenu(false) }, 200) }
  // Mode Edit Outlet: warna status bar ikut merah
  useEffect(() => { document.querySelector('meta[name="theme-color"]')?.setAttribute('content', editMode ? '#B3261E' : '#0B1F4B'); return () => document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0B1F4B') }, [editMode])

  const list: Baris[] = rows
    .map(r => ({ ...r, d: r.lat == null || !pos ? null : meters(pos.lat, pos.lng, r.lat, r.long as number) }))
    .filter(r => !q.trim() || (r.name + ' ' + r.address).toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (a.d ?? 1e12) - (b.d ?? 1e12))
  const done = rows.filter(r => visited.has(r.id)).length

  return (<>
    {form && <OutletForm me={me} rayon={rayon} pos={pos} outlet={form === 'new' ? null : form} onClose={() => setForm(null)} onSaved={() => { const id = form !== 'new' ? form?.id : null; setForm(null); onReload(true); onToast('Outlet tersimpan'); if (id) { setSavedId(id); setTimeout(() => setSavedId(null), 2000) } }}
      onDeleted={(r: string) => { setForm(null); setEditMode(false); onReload(); onToast(r === 'deleted' ? 'Outlet dihapus' : 'Outlet dinonaktifkan') }} />}
    {menu && <div className={`drawer ${closingMenu ? 'out' : ''}`} onClick={closeMenu}><div onClick={e => e.stopPropagation()}>
      <h3>Menu</h3>
      <a onClick={() => { closeMenu(); setEditMode(true); buzz(25) }}><Icon name="edit" size={20} /> Edit Outlet</a>
      <a onClick={() => { closeMenu(); dlg.alert({ title: 'TaskPro', message: 'Aplikasi kunjungan dan penjualan Taskforce.' }) }}><Icon name="info" size={20} /> About</a></div></div>}
    <div className={`ph-head ${editMode ? 'editing' : ''}`}>
      <div className="hrow">
        <button className="icon" aria-label="Menu" onClick={() => setMenu(true)}><Icon name="dots" /></button>
        <h3 className="htitle">{editMode ? 'Mode Edit Outlet' : 'Input Selling'}</h3><div className="grow" />
        {editMode
          ? <button className="donebtn" onClick={() => setEditMode(false)}><Icon name="check" size={18} /> Selesai</button>
          : <>          <button className="icon" aria-label="Refresh lokasi" onClick={() => { setSpin(true); setTimeout(() => setSpin(false), 700); getPos(); buzz(10) }}><Icon name="refresh" className={spin ? 'spin' : ''} /></button>
          <button className="icon" aria-label="Tambah outlet" onClick={() => setForm('new')}><Icon name="plus" /></button></>}</div>
      <div className="hrow"><input placeholder="Cari outlet…" value={q} onChange={e => setQ(e.target.value)} style={{ flex: 1 }} />
        <select value={rayon} style={{ width: 92 }} onChange={e => { setRayon(+e.target.value); localStorage.setItem('rayon', e.target.value) }}>
          {Array.from({ length: 24 }, (_, i) => <option key={i} value={i + 1}>R{String(i + 1).padStart(2, '0')}</option>)}</select></div>
      {!editMode && <div className="progress" aria-label="Progres kunjungan"><div className="bar" style={{ width: rows.length ? `${(done / rows.length) * 100}%` : 0 }} /></div>}
      <div className="hint">{editMode ? 'Ketuk outlet yang ingin diubah. Check-in dinonaktifkan sampai Anda menekan Selesai.' : `${done} dari ${rows.length} outlet sudah dikunjungi hari ini`}</div>
    </div>
    {bar}
    {err && <p className="err" role="alert" style={{ padding: '8px 16px', margin: 0 }}>{err}</p>}
    {loading ? <SkelRows n={6} /> : list.length === 0 && luring ? <div className="empty"><b>Daftar outlet butuh sinyal</b><p className="muted">Check-in baru bisa dilakukan setelah sinyal kembali. Check-out yang tersimpan di HP akan terkirim otomatis.</p></div>
      : list.length === 0 ? <div className="empty"><b>Belum ada outlet di rayon R{String(rayon).padStart(2, '0')}</b><p className="muted">Pilih rayon lain, atau tambah outlet baru dengan tombol + di kanan atas.</p></div>
      : list.map((r, i) => <div className={`item ${r.lat == null ? 'nolat-row' : ''} ${savedId === r.id ? 'flash' : ''}`} style={{ ['--i' as string]: Math.min(i, 10) }} key={r.id} onClick={() => !busy && (editMode ? setForm(r) : onMasuk(r))}>
        <div className={`dist ${r.lat == null ? 'nolat' : r.d != null && r.d <= 50 ? 'near' : ''}`} title={r.lat == null ? 'Lokasi outlet belum ada' : undefined}>{busyId === r.id ? <span className="spinner" /> : r.lat == null ? <Icon name="alert" size={24} /> : r.d == null ? '?' : fmt(r.d)}</div>
        <div className="grow"><b>{r.name}</b>{visited.has(r.id) && <span className="badge ok"><Icon name="check" size={12} /> SUDAH</span>}
          <div className="muted" style={{ fontSize: 13 }}>{r.address}</div>
          {r.lat == null && <div className="nolat-msg"><Icon name="alert" size={14} /> Lokasi outlet belum ada</div>}</div>
        {r.lat != null && <a className="go" aria-label="Menuju lokasi" target="_blank" onClick={e => e.stopPropagation()} href={`https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.long}`}><Icon name="nav" size={20} /></a>}
      </div>)}
  </>)
}
