'use client'
import { useEffect, useState } from 'react'
import Shell from '../../components/Shell'
import { useDialog } from '../../components/Dialog'
import { supabase } from '../../lib/supabase'
import { loadMe } from '../../lib/auth'

function Cabang() {
  const dlg = useDialog()
  const [rows, setRows] = useState<any[]>([])
  const [ppl, setPpl] = useState<any[]>([])
  const [me, setMe] = useState<any>(null)
  const [f, setF] = useState({ kode: '', nama: '', alamat: '' })
  const [err, setErr] = useState('')
  async function load() {
    const { data } = await supabase.from('cabang').select('*').order('kode'); setRows(data || [])
    const { data: p } = await supabase.from('profiles').select('id,nama,role').in('role', ['mds', 'rmdm']); setPpl(p || [])
  }
  useEffect(() => { load(); loadMe().then(({ me }) => setMe(me)) }, [])
  const nm = (id: string) => ppl.find(x => x.id === id)?.nama || '-'
  async function add() {
    if (!/^[0-9]{4}$/.test(f.kode) || !f.nama.trim() || !f.alamat.trim()) return setErr('Kode harus 4 digit, nama dan alamat wajib diisi')
    const { error } = await supabase.from('cabang').insert({ ...f, rmdm_id: me?.role === 'rmdm' ? me.id : null }) // RMDM otomatis mengcover cabang buatannya
    setErr(error ? (error.code === '23505' ? 'Kode cabang sudah dipakai' : error.message) : ''); if (!error) { setF({ kode: '', nama: '', alamat: '' }); load() }
  }
  async function del(r: any) {
    if (!(await dlg.confirm({ title: 'Hapus cabang?', tone: 'danger', okText: 'Hapus', message: <><b>{r.kode} {r.nama}</b> akan dihapus permanen.</> }))) return
    const { error } = await supabase.from('cabang').delete().eq('id', r.id)
    if (error) await dlg.alert({ title: 'Cabang tidak bisa dihapus', tone: 'danger', icon: 'close', message: 'Cabang ini masih dipakai outlet atau akun. Pindahkan atau hapus datanya dulu.' })
    load()
  }
  async function edit(r: any) {
    const v = await dlg.form({ title: `Edit cabang ${r.kode}`, okText: 'Simpan', fields: [{ key: 'nama', label: 'Nama cabang', value: r.nama }, { key: 'alamat', label: 'Alamat', value: r.alamat }] })
    if (!v) return
    if (!v.nama.trim() || !v.alamat.trim()) return void dlg.alert({ title: 'Data belum lengkap', message: 'Nama dan alamat cabang wajib diisi.', tone: 'danger', icon: 'close' })
    const { error } = await supabase.from('cabang').update({ nama: v.nama.trim(), alamat: v.alamat.trim() }).eq('id', r.id)
    if (error) await dlg.alert({ title: 'Gagal menyimpan', message: error.message, tone: 'danger', icon: 'close' })
    load()
  }
  async function setRmdm(id: string, v: string) { await supabase.from('cabang').update({ rmdm_id: v || null }).eq('id', id); load() }
  return (<>
    <h2>Cabang</h2>
    <div className="row">
      <input placeholder="Kode (4 digit)" value={f.kode} maxLength={4} inputMode="numeric" onChange={e => setF({ ...f, kode: e.target.value })} />
      <input placeholder="Nama cabang" value={f.nama} onChange={e => setF({ ...f, nama: e.target.value })} />
      <input placeholder="Alamat" value={f.alamat} onChange={e => setF({ ...f, alamat: e.target.value })} />
      <button onClick={add}>Tambah</button>
    </div>
    {err && <p className="err">{err}</p>}
    <div className="scroll"><table>
      <thead><tr><th>Kode</th><th>Nama</th><th>Alamat</th><th>MDS</th><th>RMDM</th><th /></tr></thead>
      <tbody>{rows.map(r => <tr key={r.id}>
        <td>{r.kode}</td><td>{r.nama}</td><td>{r.alamat}</td><td>{nm(r.mds_id)}</td>
        <td>{me?.role === 'mdm'
          ? <select value={r.rmdm_id || ''} onChange={e => setRmdm(r.id, e.target.value)}><option value="">-</option>{ppl.filter(x => x.role === 'rmdm').map(x => <option key={x.id} value={x.id}>{x.nama}</option>)}</select>
          : nm(r.rmdm_id)}</td>
        <td style={{ whiteSpace: 'nowrap' }}><button className="ghost" onClick={() => edit(r)}>Edit</button> <button className="ghost danger" onClick={() => del(r)}>Hapus</button></td>
      </tr>)}</tbody>
    </table></div>
  </>)
}
export default function Page() { return <Shell roles={['mdm', 'rmdm']}><Cabang /></Shell> }
