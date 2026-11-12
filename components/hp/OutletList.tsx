'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import Icon from '../Icon'
import OutletForm from '../OutletForm'
import { SkelRows } from '../Loaders'
import { useDialog } from '../Dialog'
import { buzz, fmt, meters, ringkasAlamat } from '../../lib/hp'
import RayonSheet from './RayonSheet'
import PullRefresh from './PullRefresh'
import { kodeRayon, labelHari, ringkasRayon, type JadwalHariIni } from '../../lib/jadwal'
import type { Me, Outlet, Posisi } from '../../lib/types'

type Baris = Outlet & { d: number | null }

// Tab "Input": judul, pencarian dan rayon, progres kunjungan, lalu daftar outlet (terdekat dulu). Mode Edit Outlet dan menu ada di sini.
export default function OutletList({ me, rayon, setRayon, rows, loading, visited, perRayon, pos, getPos, busy, busyId, err, onMasuk, onReload, onToast, bar, luring, jadwal }: {
  me: Me; rayon: number; setRayon: (r: number) => void; rows: Outlet[]; loading: boolean; visited: Set<number>; perRayon: Record<number, number>; pos: Posisi | null; getPos: () => void
  busy: boolean; busyId: number | null; err: string; onMasuk: (r: Outlet) => void; onReload: (keep?: boolean) => void; onToast: (t: string) => void; bar?: ReactNode; luring?: boolean; jadwal?: JadwalHariIni | null }) {
  const dlg = useDialog()
  const [q, setQ] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState<Outlet | 'new' | null>(null)
  const [menu, setMenu] = useState(false)
  const [closingMenu, setClosingMenu] = useState(false)
  const [sheetRayon, setSheetRayon] = useState(false)
  const [savedId, setSavedId] = useState<number | null>(null)
  const closeMenu = () => { setClosingMenu(true); setTimeout(() => { setMenu(false); setClosingMenu(false) }, 200) }
  // Mode Edit Outlet: warna status bar ikut merah
  useEffect(() => { document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#F2F4F9'); return () => document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#F2F4F9') }, [editMode])

  const list: Baris[] = rows
    .map(r => ({ ...r, d: r.lat == null || !pos ? null : meters(pos.lat, pos.lng, r.lat, r.long as number) }))
    .filter(r => !q.trim() || (r.name + ' ' + r.address).toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (a.d ?? 1e12) - (b.d ?? 1e12))
  const done = rows.filter(r => visited.has(r.id)).length
  // Jadwal dikunci MDM/RMDM: rayon tidak bisa dipilih, daftar mengikuti rayon jadwal hari ini.
  const terkunci = !!jadwal?.locked, rayonJadwal = jadwal?.rayon || []
  const namaRayon = terkunci ? (rayonJadwal.length ? ringkasRayon(rayonJadwal) : 'Tidak ada jadwal') : kodeRayon(rayon)
  const selesai = rows.length > 0 && done === rows.length, sudahSelesai = useRef(false)
  useEffect(() => { if (selesai && !sudahSelesai.current) { sudahSelesai.current = true; buzz(40) } if (!selesai) sudahSelesai.current = false }, [selesai])   // getar singkat sekali saat semua outlet selesai
  const saranJadwal = !terkunci && rayonJadwal.length > 0 && !rayonJadwal.includes(rayon) ? rayonJadwal[0] : null   // petunjuk saja: tidak mengubah pilihan sendiri

  return (<>
    {form && <OutletForm me={me} rayon={terkunci && rayonJadwal.length ? rayonJadwal[0] : rayon} rayonKunci={terkunci} pos={pos} outlet={form === 'new' ? null : form} onClose={() => setForm(null)} onSaved={() => { const id = form !== 'new' ? form?.id : null; setForm(null); onReload(true); onToast('Outlet tersimpan'); if (id) { setSavedId(id); setTimeout(() => setSavedId(null), 2000) } }}
      onDeleted={(r: string) => { setForm(null); setEditMode(false); onReload(); onToast(r === 'deleted' ? 'Outlet dihapus' : 'Outlet dinonaktifkan') }} />}
    {menu && <div className={`drawer ${closingMenu ? 'out' : ''}`} onClick={closeMenu}><div onClick={e => e.stopPropagation()}>
      <h3>Menu</h3>
      <a onClick={() => { closeMenu(); setEditMode(true); buzz(25) }}><Icon name="edit" size={20} /> Edit Outlet</a>
      <a onClick={() => { closeMenu(); getPos(); onReload(true); buzz(10) }}><Icon name="refresh" size={20} /> Perbarui lokasi</a>
      <a onClick={() => { closeMenu(); dlg.alert({ title: 'TaskPro', message: 'Aplikasi kunjungan dan penjualan Taskforce.' }) }}><Icon name="info" size={20} /> About</a></div></div>}
    {sheetRayon && <RayonSheet rayon={rayon} jadwal={rayonJadwal} perRayon={perRayon} onPilih={r => { setRayon(r); localStorage.setItem('rayon', String(r)); buzz(10) }} onClose={() => setSheetRayon(false)} />}
    <PullRefresh aktif={!editMode && !form && !sheetRayon} onRefresh={() => { getPos(); onReload(true); buzz(10) }} />
    <div className={`ph-head light ${editMode ? 'editing' : ''}`}>
      <div className="hrow">
        <button className="icon" aria-label="Menu" onClick={() => setMenu(true)}><Icon name="dots" /></button>
        <label className="searchfield"><Icon name="search" size={18} /><input type="search" aria-label="Cari outlet" placeholder="Cari outlet…" value={q} onChange={e => setQ(e.target.value)} /></label>
        {editMode
          ? <button className="donebtn" onClick={() => setEditMode(false)}><Icon name="check" size={18} /> Selesai</button>
          : terkunci
            ? <div className="rayon-kunci" role="status" aria-label={`Rayon dikunci mengikuti jadwal: ${namaRayon}`} title="Rayon mengikuti jadwal yang ditetapkan admin"><Icon name="lock" size={16} />{namaRayon}</div>
            : <button className="rayonbtn" aria-label={`Rayon ${namaRayon}, ketuk untuk mengganti`} aria-haspopup="dialog" onClick={() => setSheetRayon(true)}>{namaRayon}<Icon name="chevron" size={16} className="rot90" /></button>}
      </div>
      {editMode && <div className="editbanner" role="status"><Icon name="alert" size={16} /> Mode edit · check-in dinonaktifkan</div>}
    </div>
    <div className="bigtitle">
      <h1>{editMode ? 'Edit Outlet' : 'Input Selling'}</h1>
      {!editMode && <span className={`countbadge ${selesai ? 'done' : ''}`} role="progressbar" aria-label="Progres kunjungan" aria-valuemin={0} aria-valuemax={rows.length} aria-valuenow={done}>{selesai && <Icon name="check" size={14} />}{done}/{rows.length}</span>}
    </div>
    {!editMode && terkunci && jadwal?.minggu != null && jadwal.hari != null && <div className="jadwal-hint light"><Icon name="lock" size={14} /> Jadwal dikunci · {labelHari(jadwal.minggu, jadwal.hari)}</div>}
    {!editMode && saranJadwal && <div className="jadwal-hint light"><Icon name="info" size={14} /> Jadwal hari ini {ringkasRayon(rayonJadwal)}
      <button type="button" onClick={() => { setRayon(saranJadwal); localStorage.setItem('rayon', String(saranJadwal)) }}>Pakai {kodeRayon(saranJadwal)}</button></div>}
    {bar}
    {err && <p className="err" role="alert" style={{ padding: '8px 16px', margin: 0 }}>{err}</p>}
    {loading ? <SkelRows n={6} /> : list.length === 0 && luring ? <div className="empty"><b>Daftar outlet butuh sinyal</b><p className="muted">Check-in baru bisa dilakukan setelah sinyal kembali. Check-out yang tersimpan di HP akan terkirim otomatis.</p></div>
      : terkunci && rayonJadwal.length === 0 ? <div className="empty"><b>Tidak ada jadwal kunjungan hari ini</b><p className="muted">Jadwal Anda dikunci oleh admin dan hari ini tidak ada rayon yang dijadwalkan. Hubungi MDS atau MDM jika ini keliru.</p></div>
      : list.length === 0 ? <div className="empty"><b>Belum ada outlet di rayon {namaRayon}</b><p className="muted">{terkunci ? 'Hubungi MDS atau MDM untuk menambahkan outlet di rayon jadwal Anda.' : 'Pilih rayon lain, atau tambah outlet baru dengan tombol + di kanan bawah.'}</p></div>
      : list.map((r, i) => {
        const dekat = r.lat != null && r.d != null && r.d <= 50
        return <div className={`item ${r.lat == null ? 'nolat-row' : ''} ${savedId === r.id ? 'flash' : ''}`} style={{ ['--i' as string]: Math.min(i, 10) }} key={r.id} onClick={() => !busy && (editMode ? setForm(r) : onMasuk(r))}>
          <div className={`dist ${r.lat == null ? 'nolat' : dekat ? 'near' : ''}`} title={r.lat == null ? 'Lokasi outlet belum ada' : undefined}>{busyId === r.id ? <span className="spinner" /> : r.lat == null ? <Icon name="alert" size={24} /> : r.d == null ? '?' : fmt(r.d)}</div>
          <div className="grow"><b className="oname">{r.name}</b>{visited.has(r.id) && <span className="badge ok"><Icon name="check" size={12} /> SUDAH</span>}
            <div className="addr" title={r.address}>{ringkasAlamat(r.address)}</div>
            {r.lat == null && <div className="nolat-msg"><Icon name="alert" size={14} /> Lokasi outlet belum ada</div>}</div>
          {editMode ? <span className="rowact edit" aria-hidden="true"><Icon name="edit" size={18} /></span>
            : dekat ? <button type="button" className="masuk" disabled={busy} onClick={e => { e.stopPropagation(); onMasuk(r) }}>Masuk</button>
            : r.lat != null && <a className="rute" aria-label={`Rute ke ${r.name}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} href={`https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.long}`}><Icon name="nav" size={16} /> Rute</a>}
        </div>
      })}
    {!editMode && <button type="button" className="fab" aria-label="Tambah outlet" onClick={() => setForm('new')}><Icon name="plus" size={26} /></button>}
  </>)
}
