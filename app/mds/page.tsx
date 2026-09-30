'use client'
import { useEffect, useState } from 'react'
import Shell from '../../components/Shell'
import Icon from '../../components/Icon'
import { useDialog } from '../../components/Dialog'
import { supabase } from '../../lib/supabase'
import { loadMe } from '../../lib/auth'
import { api } from '../../lib/api'
import { useAktif } from '../../lib/sesi'
import { jam } from '../../lib/rekap'

const EMPTY = { role: 'mds', user_id: '', nama: '', password: '', cabang_id: '' }

function Mds() {
  const dlg = useDialog()
  const [list, setList] = useState<any[]>([])
  const [cabang, setCabang] = useState<any[]>([])
  const [f, setF] = useState(EMPTY)
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const [role, setRole] = useState('')
  const [aktif, refreshAktif] = useAktif()
  async function load() {
    const { data: p } = await supabase.from('profiles').select('id,user_id,nama,role').in('role', ['mds', 'rmdm', 'mdm']).order('user_id')
    const { data: c } = await supabase.from('cabang').select('id,kode,nama,mds_id,rmdm_id').order('kode')
    setList(p || []); setCabang(c || [])
  }
  useEffect(() => { load(); loadMe().then(({ me }) => setRole(me?.role || '')) }, [])
  const bebasMds = cabang.filter(c => !c.mds_id), bebasR = cabang.filter(c => !c.rmdm_id)
  const cb = (c: any) => `${c.kode} ${c.nama}`

  async function create() {
    setErr('')
    if (!f.user_id.trim() || !f.nama.trim() || !f.password) return setErr('User ID, nama, dan password wajib diisi')
    if (f.role === 'mds' && !f.cabang_id) return setErr('Pilih 1 cabang untuk MDS ini')
    setBusy(true); const e = await api('/api/mds', 'POST', f); setBusy(false); setErr(e)
    if (!e) { setF({ ...EMPTY, role: f.role }); await load(); dlg.alert({ title: 'Akun dibuat', tone: 'ok', message: <>Akun <b>{f.user_id.trim().toUpperCase()}</b> berhasil dibuat.</> }) }
  }
  async function remove(m: any) {
    if (!(await dlg.confirm({ title: `Hapus akun ${m.role.toUpperCase()}?`, tone: 'danger', okText: 'Hapus', message: <><b>{m.nama}</b> ({m.user_id}) akan dihapus. Cabang yang dipegang akan kembali kosong.</> }))) return
    const e = await api('/api/mds', 'DELETE', { id: m.id }); if (e) await dlg.alert({ title: 'Gagal menghapus', message: e, tone: 'danger', icon: 'close' }); load()
  }
  async function op(body: any, konfirmasi?: { title: string; message: any }) {
    if (konfirmasi && !(await dlg.confirm({ ...konfirmasi, okText: 'Ya, lanjut' }))) return
    const e = await api('/api/mds', 'PATCH', body)
    if (e) await dlg.alert({ title: 'Gagal menyimpan', message: e, tone: 'danger', icon: 'close' })
    load()
  }
  async function paksa(m: any) {
    if (!(await dlg.confirm({ title: 'Logout paksa?', icon: 'logout', tone: 'danger', okText: 'Logout paksa', message: <><b>{m.nama}</b> akan dikeluarkan dari semua perangkat dalam hitungan detik.</> }))) return
    const e = await api('/api/sesi', 'POST', { id: m.id }); if (e) await dlg.alert({ title: 'Gagal', message: e, tone: 'danger', icon: 'close' }); refreshAktif()
  }
  const status = (m: any) => aktif[m.id]
    ? <><span className="on-badge">Aktif</span><span className="off-badge">terakhir {jam(aktif[m.id]).slice(0, 5)}</span></>
    : <span className="off-badge">Tidak aktif</span>
  const aksiSesi = (m: any) => aktif[m.id] && <button className="ghost danger" onClick={() => paksa(m)}><Icon name="logout" size={16} /> Logout paksa</button>

  return (<>
    <h2>MDS &amp; RMDM</h2>
    <div className="card">
      <span className="label" style={{ marginBottom: 8 }}>Buat akun baru</span>
      <div className="row" style={{ alignItems: 'flex-end', marginBottom: 0 }}>
        <label className="fld-inline"><span className="label">Role</span>
          <select value={f.role} onChange={e => setF({ ...f, role: e.target.value, cabang_id: '' })}><option value="mds">MDS (1 cabang)</option>{role === 'mdm' && <option value="rmdm">RMDM (banyak cabang)</option>}</select></label>
        <label className="fld-inline"><span className="label">User ID</span><input placeholder="mis. 0300-MDS01" value={f.user_id} autoCapitalize="characters" onChange={e => setF({ ...f, user_id: e.target.value })} /></label>
        <label className="fld-inline"><span className="label">Nama</span><input value={f.nama} onChange={e => setF({ ...f, nama: e.target.value })} /></label>
        <label className="fld-inline"><span className="label">Password sementara</span><input value={f.password} placeholder="min. 6 karakter" onChange={e => setF({ ...f, password: e.target.value })} /></label>
        {f.role === 'mds' && <label className="fld-inline"><span className="label">Cabang</span>
          <select value={f.cabang_id} onChange={e => setF({ ...f, cabang_id: e.target.value })}><option value="">Pilih cabang…</option>{bebasMds.map(c => <option key={c.id} value={c.id}>{cb(c)}</option>)}</select></label>}
        <button disabled={busy} onClick={create}>{busy ? 'Membuat…' : 'Buat akun'}</button>
      </div>
      {f.role === 'mds' && bebasMds.length === 0 && <p className="hint-box" style={{ margin: '12px 0 0' }}>Semua cabang yang bisa Anda kelola sudah punya MDS. Tambahkan cabang baru di menu Cabang, atau pindahkan MDS lama ke cabang lain.</p>}
      {f.role === 'rmdm' && <p className="muted" style={{ margin: '12px 0 0', fontSize: 13 }}>Cabang yang dicover RMDM diatur setelah akun dibuat (boleh lebih dari satu).</p>}
      {err && <p className="err" role="alert" style={{ margin: '12px 0 0' }}>{err}</p>}
    </div>

    {list.filter(m => m.role !== 'mdm').map(m => <div className="card" key={m.id}>
      <div className="row"><b>{m.nama}</b><span className="chip">{m.role.toUpperCase()}</span><span className="muted">{m.user_id}</span>{status(m)}<div className="grow" />
        {aksiSesi(m)}<button className="ghost danger" onClick={() => remove(m)}><Icon name="trash" size={16} /> Hapus</button></div>
      {m.role === 'mds'
        ? <div className="row" style={{ marginBottom: 0 }}>
            {cabang.filter(c => c.mds_id === m.id).map(c => <span className="chip" key={c.id}>{cb(c)}</span>)}
            {!cabang.some(c => c.mds_id === m.id) && <span className="err" style={{ fontSize: 13 }}>Belum punya cabang</span>}
            <select value="" aria-label="Atur cabang MDS" onChange={e => e.target.value && op({ id: m.id, op: 'mds_cabang', cabang_id: e.target.value },
              cabang.some(c => c.mds_id === m.id) ? { title: 'Pindahkan cabang MDS?', message: <><b>{m.nama}</b> hanya bisa memegang 1 cabang, jadi cabang lamanya akan dilepas.</> } : undefined)}>
              <option value="">{cabang.some(c => c.mds_id === m.id) ? 'Pindah ke cabang…' : 'Pilih cabang…'}</option>{bebasMds.map(c => <option key={c.id} value={c.id}>{cb(c)}</option>)}</select>
            {cabang.some(c => c.mds_id === m.id) && <button className="ghost" onClick={() => op({ id: m.id, op: 'mds_cabang', cabang_id: null }, { title: 'Lepas cabang dari MDS?', message: <>Cabang akan kosong sampai diberikan ke MDS lain.</> })}>Lepas cabang</button>}
          </div>
        : <div className="row" style={{ marginBottom: 0 }}>
            {cabang.filter(c => c.rmdm_id === m.id).map(c => <span className="chip" key={c.id}>{cb(c)}{role === 'mdm' && <a role="button" aria-label={`Lepas ${c.kode}`} onClick={() => op({ id: m.id, op: 'rmdm_remove', cabang_id: c.id })}> ✕</a>}</span>)}
            {role === 'mdm' ? <select value="" onChange={e => e.target.value && op({ id: m.id, op: 'rmdm_add', cabang_id: e.target.value })}>
              <option value="">+ Tambah cabang yang dicover…</option>{bebasR.map(c => <option key={c.id} value={c.id}>{cb(c)}</option>)}</select>
              : <span className="muted">Hanya MDM yang bisa mengatur cakupan RMDM.</span>}</div>}
    </div>)}

    {role === 'mdm' && list.some(m => m.role === 'mdm') && <>
      <span className="label" style={{ margin: '20px 0 8px' }}>Akun MDM</span>
      {list.filter(m => m.role === 'mdm').map(m => <div className="card" key={m.id}>
        <div className="row" style={{ marginBottom: 0 }}><b>{m.nama}</b><span className="chip">MDM</span><span className="muted">{m.user_id}</span>{status(m)}<div className="grow" />{aksiSesi(m)}</div></div>)}
    </>}
  </>)
}
export default function Page() { return <Shell roles={['mdm', 'rmdm']}><Mds /></Shell> }
