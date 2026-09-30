'use client'
import { useEffect, useState } from 'react'
import Shell from '../../components/Shell'
import Icon from '../../components/Icon'
import { useDialog } from '../../components/Dialog'
import { supabase } from '../../lib/supabase'
import { loadMe } from '../../lib/auth'
import { api as call } from '../../lib/api'
import { useAktif } from '../../lib/sesi'
import { jam } from '../../lib/rekap'

const api = (method: string, body: any) => call('/api/akun', method, body)

const LABEL: Record<string, string> = { tl: 'TL', kormot: 'Kormot', frontliner: 'Frontliner' }
const EMPTY = { role: 'frontliner', user_id: '', nama: '', password: '', atasan_id: '' }

function Frontliner() {
  const dlg = useDialog()
  const [aktif, refreshAktif] = useAktif()
  const [cabang, setCabang] = useState<any[]>([])
  const [cid, setCid] = useState('')
  const [list, setList] = useState<any[]>([])
  const [f, setF] = useState(EMPTY)
  const [editId, setEditId] = useState('')
  const [err, setErr] = useState('')
  const [role, setRole] = useState('')
  const kode = cabang.find(c => c.id === cid)?.kode
  useEffect(() => {
    supabase.from('cabang').select('id,kode,nama').order('kode').then(({ data }) => { setCabang(data || []); if (data?.length) setCid(data[0].id) })
    loadMe().then(({ me }) => setRole(me?.role || ''))
  }, [])
  async function load() {
    if (!cid) return setList([])
    const { data } = await supabase.from('profiles').select('id,user_id,nama,role,atasan_id,gps_required').eq('cabang_id', cid).order('user_id')
    setList(data || [])
  }
  useEffect(() => { load(); setEditId(''); setF(EMPTY) }, [cid])
  const atasan = list.filter(x => x.role !== 'frontliner')
  const nama = (id: string) => list.find(x => x.id === id)?.nama || '-'
  async function submit() {
    const e = editId ? await api('PATCH', { id: editId, nama: f.nama, password: f.password, atasan_id: f.atasan_id })
                     : await api('POST', { ...f, cabang_id: cid })
    setErr(e); if (!e) { setF(EMPTY); setEditId(''); load() }
  }
  function edit(x: any) { setEditId(x.id); setF({ role: x.role, user_id: x.user_id, nama: x.nama, password: '', atasan_id: x.atasan_id || '' }); setErr('') }
  async function setGps(id: string, v: boolean) { setErr(await api('PATCH', { id, gps_required: v })); load() }
  async function remove(x: any) {
    if (!(await dlg.confirm({ title: 'Hapus akun ini?', tone: 'danger', okText: 'Hapus', message: <><b>{x.nama}</b> ({x.user_id}) akan dihapus permanen.</> }))) return
    const e = await api('DELETE', { id: x.id }); if (e) await dlg.alert({ title: 'Gagal menghapus', message: e, tone: 'danger', icon: 'close' }); load()
  }
  async function paksa(x: any) {
    if (!(await dlg.confirm({ title: 'Logout paksa?', icon: 'logout', tone: 'danger', okText: 'Logout paksa', message: <><b>{x.nama}</b> akan dikeluarkan dari perangkatnya dalam hitungan detik.</> }))) return
    const e = await call('/api/sesi', 'POST', { id: x.id }); if (e) await dlg.alert({ title: 'Gagal', message: e, tone: 'danger', icon: 'close' }); refreshAktif()
  }
  return (<>
    <h2>Frontliner</h2>
    <div className="row">
      <select value={cid} onChange={e => setCid(e.target.value)}>
        <option value="">Pilih cabang…</option>{cabang.map(c => <option key={c.id} value={c.id}>{c.kode} {c.nama}</option>)}
      </select>
    </div>
    {cid && <>
      <div className="card">
        <b>{editId ? 'Edit akun ' + f.user_id : 'Tambah akun'}</b>
        <div className="row" style={{ marginTop: 8 }}>
          <select value={f.role} disabled={!!editId} onChange={e => setF({ ...f, role: e.target.value })}>
            {Object.entries(LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input placeholder={`User ID (mis. ${kode}-TMTB01)`} disabled={!!editId} value={f.user_id} onChange={e => setF({ ...f, user_id: e.target.value })} />
          <input placeholder="Nama" value={f.nama} onChange={e => setF({ ...f, nama: e.target.value })} />
          <input placeholder={editId ? 'Password baru (kosongkan jika tidak diganti)' : 'Password sementara'} value={f.password} onChange={e => setF({ ...f, password: e.target.value })} />
          {f.role === 'frontliner' && <select value={f.atasan_id} onChange={e => setF({ ...f, atasan_id: e.target.value })}>
            <option value="">Pilih atasan (TL/Kormot)…</option>{atasan.map(a => <option key={a.id} value={a.id}>{a.nama} ({LABEL[a.role]})</option>)}
          </select>}
          <button onClick={submit}>{editId ? 'Simpan' : 'Tambah'}</button>
          {editId && <button className="ghost" onClick={() => { setEditId(''); setF(EMPTY); setErr('') }}>Batal</button>}
        </div>
        {err && <p className="err">{err}</p>}
      </div>
      <div className="scroll"><table>
        <thead><tr><th>User ID</th><th>Nama</th><th>Role</th><th>Atasan</th><th>GPS wajib</th><th>Status</th><th /></tr></thead>
        <tbody>{list.map(x => <tr key={x.id}><td>{x.user_id}</td><td>{x.nama}</td><td>{LABEL[x.role] || x.role.toUpperCase()}</td>
          <td>{x.atasan_id ? nama(x.atasan_id) : '-'}</td>
          <td>{x.role !== 'frontliner' ? '-' : role === 'mdm'
            ? <label className="switch" title="Matikan untuk mengecualikan frontliner ini dari GPS wajib dan batas 50 m"><input type="checkbox" checked={x.gps_required !== false} onChange={e => setGps(x.id, e.target.checked)} /><span /></label>
            : (x.gps_required === false ? 'Dikecualikan' : 'Wajib')}</td>
          <td>{aktif[x.id] ? <><span className="on-badge">Aktif</span><div className="off-badge">terakhir {jam(aktif[x.id]).slice(0, 5)}</div></> : <span className="off-badge">Tidak aktif</span>}</td>
          <td style={{ whiteSpace: 'nowrap' }}>{aktif[x.id] && <><button className="ghost danger" onClick={() => paksa(x)}><Icon name="logout" size={16} /> Logout paksa</button> </>}
            {LABEL[x.role] && <><button className="ghost" onClick={() => edit(x)}>Edit</button> <button className="ghost danger" onClick={() => remove(x)}>Hapus</button></>}</td></tr>)}</tbody>
      </table></div>
    </>}
  </>)
}
export default function Page() { return <Shell roles={['mds', 'mdm', 'rmdm']}><Frontliner /></Shell> }
