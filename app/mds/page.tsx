'use client'
import { useEffect, useState } from 'react'
import Shell from '../../components/Shell'
import { supabase } from '../../lib/supabase'

async function api(method: string, body: any) {
  const { data } = await supabase.auth.getSession()
  const r = await fetch('/api/mds', { method, body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session?.access_token } })
  return r.ok ? '' : ((await r.json()).error as string)
}

function Mds() {
  const [list, setList] = useState<any[]>([])
  const [cabang, setCabang] = useState<any[]>([])
  const [f, setF] = useState({ role: 'mds', user_id: '', nama: '', password: '' })
  const [err, setErr] = useState('')
  async function load() {
    const { data: p } = await supabase.from('profiles').select('id,user_id,nama,role').in('role', ['mds', 'rmdm']).order('user_id')
    const { data: c } = await supabase.from('cabang').select('id,kode,nama,mds_id,rmdm_id').order('kode')
    setList(p || []); setCabang(c || [])
  }
  useEffect(() => { load() }, [])
  async function create() {
    const e = await api('POST', f); setErr(e)
    if (!e) { setF({ ...f, user_id: '', nama: '', password: '' }); load() }
  }
  async function remove(id: string) {
    if (!confirm('Hapus akun ini? Cabangnya akan kembali kosong.')) return
    setErr(await api('DELETE', { id })); load()
  }
  async function assign(cabangId: string, mdsId: string | null) {
    await supabase.from('cabang').update({ mds_id: mdsId }).eq('id', cabangId); load()
  }
  const kosong = cabang.filter(c => !c.mds_id)
  return (<>
    <h2>MDS &amp; RMDM</h2>
    <div className="row">
      <select value={f.role} onChange={e => setF({ ...f, role: e.target.value })}><option value="mds">MDS</option><option value="rmdm">RMDM (hanya MDM)</option></select>
      <input placeholder="User ID (mis. 0300-MDS01)" value={f.user_id} onChange={e => setF({ ...f, user_id: e.target.value })} />
      <input placeholder="Nama" value={f.nama} onChange={e => setF({ ...f, nama: e.target.value })} />
      <input placeholder="Password sementara" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} />
      <button onClick={create}>Buat akun</button>
    </div>
    {err && <p className="err">{err}</p>}
    {list.map(m => <div className="card" key={m.id}>
      <div className="row"><b>{m.nama}</b><span className="chip">{m.role.toUpperCase()}</span><span className="muted">{m.user_id}</span><div className="grow" />
        <button className="ghost danger" onClick={() => remove(m.id)}>Hapus</button></div>
      {m.role === 'mds'
        ? <div className="row">
            {cabang.filter(c => c.mds_id === m.id).map(c => <span className="chip" key={c.id}>{c.kode} {c.nama}<a onClick={() => assign(c.id, null)}> ✕</a></span>)}
            <select value="" onChange={e => e.target.value && assign(e.target.value, m.id)}>
              <option value="">+ Tambah cabang…</option>{kosong.map(c => <option key={c.id} value={c.id}>{c.kode} {c.nama}</option>)}
            </select></div>
        : <div className="row muted">Cabang dicover: {cabang.filter(c => c.rmdm_id === m.id).map(c => c.kode + ' ' + c.nama).join(', ') || '- (atur di halaman Cabang)'}</div>}
    </div>)}
  </>)
}
export default function Page() { return <Shell roles={['mdm', 'rmdm']}><Mds /></Shell> }
