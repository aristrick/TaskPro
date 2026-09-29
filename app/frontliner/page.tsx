'use client'
import { useEffect, useState } from 'react'
import Shell from '../../components/Shell'
import { supabase } from '../../lib/supabase'

async function api(method: string, body: any) {
  const { data } = await supabase.auth.getSession()
  const r = await fetch('/api/akun', { method, body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session?.access_token } })
  return r.ok ? '' : ((await r.json()).error as string)
}
const LABEL: Record<string, string> = { tl: 'TL', kormot: 'Kormot', frontliner: 'Frontliner' }
const EMPTY = { role: 'frontliner', user_id: '', nama: '', password: '', atasan_id: '' }

function Frontliner() {
  const [cabang, setCabang] = useState<any[]>([])
  const [cid, setCid] = useState('')
  const [list, setList] = useState<any[]>([])
  const [f, setF] = useState(EMPTY)
  const [editId, setEditId] = useState('')
  const [err, setErr] = useState('')
  const kode = cabang.find(c => c.id === cid)?.kode
  useEffect(() => { supabase.from('cabang').select('id,kode,nama').order('kode').then(({ data }) => setCabang(data || [])) }, [])
  async function load() {
    if (!cid) return setList([])
    const { data } = await supabase.from('profiles').select('id,user_id,nama,role,atasan_id').eq('cabang_id', cid).order('user_id')
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
  async function remove(id: string) {
    if (!confirm('Hapus akun ini?')) return
    setErr(await api('DELETE', { id })); load()
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
        <thead><tr><th>User ID</th><th>Nama</th><th>Role</th><th>Atasan</th><th /></tr></thead>
        <tbody>{list.map(x => <tr key={x.id}><td>{x.user_id}</td><td>{x.nama}</td><td>{LABEL[x.role] || x.role.toUpperCase()}</td>
          <td>{x.atasan_id ? nama(x.atasan_id) : '-'}</td>
          <td>{LABEL[x.role] && <><button className="ghost" onClick={() => edit(x)}>Edit</button> <button className="ghost danger" onClick={() => remove(x.id)}>Hapus</button></>}</td></tr>)}</tbody>
      </table></div>
    </>}
  </>)
}
export default function Page() { return <Shell roles={['mds', 'mdm', 'rmdm']}><Frontliner /></Shell> }
