'use client'
import { useEffect, useState } from 'react'
import Shell from '../../components/Shell'
import { supabase } from '../../lib/supabase'

function Cabang() {
  const [rows, setRows] = useState<any[]>([])
  const [ppl, setPpl] = useState<any[]>([])
  const [me, setMe] = useState<any>(null)
  const [f, setF] = useState({ kode: '', nama: '', alamat: '' })
  const [err, setErr] = useState('')
  async function load() {
    const { data } = await supabase.from('cabang').select('*').order('kode'); setRows(data || [])
    const { data: p } = await supabase.from('profiles').select('id,nama,role').in('role', ['mds', 'rmdm']); setPpl(p || [])
  }
  useEffect(() => {
    load()
    supabase.auth.getUser().then(async ({ data }) => {
      const { data: p } = await supabase.from('profiles').select('id,role').eq('id', data.user!.id).single(); setMe(p)
    })
  }, [])
  const nm = (id: string) => ppl.find(x => x.id === id)?.nama || '-'
  async function add() {
    const { error } = await supabase.from('cabang').insert({ ...f, rmdm_id: me?.role === 'rmdm' ? me.id : null }) // RMDM otomatis mengcover cabang buatannya
    setErr(error ? error.message : ''); if (!error) { setF({ kode: '', nama: '', alamat: '' }); load() }
  }
  async function del(id: string) {
    if (!confirm('Hapus cabang ini?')) return
    const { error } = await supabase.from('cabang').delete().eq('id', id)
    setErr(error ? 'Tidak bisa dihapus (masih dipakai outlet/user): ' + error.message : ''); load()
  }
  async function edit(r: any) {
    const nama = prompt('Nama cabang', r.nama); if (nama === null) return
    const alamat = prompt('Alamat', r.alamat); if (alamat === null) return
    await supabase.from('cabang').update({ nama, alamat }).eq('id', r.id); load()
  }
  async function setRmdm(id: string, v: string) { await supabase.from('cabang').update({ rmdm_id: v || null }).eq('id', id); load() }
  return (<>
    <h2>Cabang</h2>
    <div className="row">
      <input placeholder="Kode (4 digit)" value={f.kode} maxLength={4} onChange={e => setF({ ...f, kode: e.target.value })} />
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
        <td><button className="ghost" onClick={() => edit(r)}>Edit</button> <button className="ghost danger" onClick={() => del(r.id)}>Hapus</button></td>
      </tr>)}</tbody>
    </table></div>
  </>)
}
export default function Page() { return <Shell roles={['mdm', 'rmdm']}><Cabang /></Shell> }
