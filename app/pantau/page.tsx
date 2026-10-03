'use client'
import { useEffect, useState } from 'react'
import Shell from '../../components/Shell'
import { SkelRows } from '../../components/Loaders'
import { supabase } from '../../lib/supabase'
import { loadMe } from '../../lib/auth'
import { dt } from '../../lib/rekap'

// Pemantauan: kunjungan yang ditandai mencurigakan (semua peran), jejak audit dan error aplikasi (khusus MDM).
type Tab = 'sus' | 'audit' | 'err'
function Pantau() {
  const [role, setRole] = useState('')
  const [tab, setTab] = useState<Tab>('sus')
  const [rows, setRows] = useState<any[] | null>(null)
  const [nama, setNama] = useState<Record<string, string>>({})
  const [aksi, setAksi] = useState('')
  const mdm = role === 'mdm'
  useEffect(() => { loadMe().then(({ me }) => setRole(me?.role || '')) }, [])
  useEffect(() => {
    if (!role) return
    setRows(null); setAksi('')
    ;(async () => {
      if (tab === 'sus') {
        const { data } = await supabase.from('visits').select('id,checkin_at,checkin_dist,checkin_acc,suspect_reason,cabang(tz),fl:profiles(user_id,nama),outlets(name,code)').eq('suspect', true).order('checkin_at', { ascending: false }).limit(200)
        return setRows(data || [])
      }
      if (tab === 'audit') { const { data } = await supabase.from('audit_log').select('*').order('at', { ascending: false }).limit(200); return setRows(data || []) }
      const { data } = await supabase.from('error_log').select('*').order('at', { ascending: false }).limit(100)
      const ids = [...new Set((data || []).map((x: any) => x.user_id).filter(Boolean))]
      if (ids.length) { const { data: p } = await supabase.from('profiles').select('id,user_id,nama').in('id', ids); setNama(Object.fromEntries((p || []).map(x => [x.id, `${x.user_id} · ${x.nama}`]))) }
      setRows(data || [])
    })()
  }, [tab, role])
  const aksiList = tab === 'audit' && rows ? [...new Set(rows.map(r => r.action))] : []
  const tabs: [Tab, string][] = [['sus', 'Kunjungan mencurigakan'], ...(mdm ? [['audit', 'Jejak audit'], ['err', 'Error aplikasi']] as [Tab, string][] : [])]
  return (<>
    <h2>Pantau</h2>
    <div className="seg" role="tablist" style={{ maxWidth: 560, marginBottom: 12 }}>
      {tabs.map(([k, t]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t}</button>)}</div>
    {rows === null ? <SkelRows n={5} /> : tab === 'sus' ? (rows.length === 0 ? <div className="card muted">Tidak ada kunjungan yang ditandai. Penanda muncul jika akurasi GPS 0 (kemungkinan lokasi palsu) atau perpindahan antar check-in tidak wajar.</div> :
      <div className="scroll"><table><thead><tr><th>Waktu</th><th>Frontliner</th><th>Outlet</th><th>Alasan</th><th>Jarak</th><th>Akurasi</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.id}><td>{dt(r.checkin_at, r.cabang?.tz)}</td><td>{r.fl?.user_id} · {r.fl?.nama}</td><td>{r.outlets?.name}<div className="muted" style={{ fontSize: 12 }}>{r.outlets?.code}</div></td>
          <td className="err">{r.suspect_reason}</td><td>{r.checkin_dist == null ? '-' : `${Math.round(r.checkin_dist)} m`}</td><td>{r.checkin_acc == null ? '-' : `${Math.round(r.checkin_acc)} m`}</td></tr>)}</tbody></table></div>)
    : tab === 'audit' ? <>
      <div className="row"><select value={aksi} onChange={e => setAksi(e.target.value)} aria-label="Filter aksi"><option value="">Semua aksi</option>{aksiList.map(a => <option key={a}>{a}</option>)}</select><span className="muted">{rows.length} catatan terbaru (disimpan 180 hari)</span></div>
      <div className="scroll"><table><thead><tr><th>Waktu</th><th>Pelaku</th><th>Aksi</th><th>Tabel</th><th>Baris</th><th>Detail</th></tr></thead>
        <tbody>{rows.filter(r => !aksi || r.action === aksi).map(r => <tr key={r.id}><td>{dt(r.at)}</td><td>{r.actor_user_id || 'sistem'}</td><td>{r.action}</td><td>{r.tabel}</td><td style={{ maxWidth: 160, overflowWrap: 'anywhere' }}>{r.row_id}</td>
          <td><details><summary>Lihat</summary><pre className="pre">{JSON.stringify(r.detail, null, 2).slice(0, 1500)}</pre></details></td></tr>)}</tbody></table></div></>
    : (rows.length === 0 ? <div className="card muted">Belum ada error tercatat.</div> :
      <div className="scroll"><table><thead><tr><th>Waktu</th><th>Pengguna</th><th>Halaman</th><th>Pesan</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.id}><td>{dt(r.at)}</td><td>{nama[r.user_id] || '-'}</td><td>{r.url}</td>
          <td><b>{r.pesan}</b><details><summary>Rincian</summary><pre className="pre">{r.stack}{'\n'}{r.ua}</pre></details></td></tr>)}</tbody></table></div>)}
  </>)
}
export default function Page() { return <Shell roles={['mds', 'mdm', 'rmdm', 'tl', 'kormot']}><Pantau /></Shell> }
