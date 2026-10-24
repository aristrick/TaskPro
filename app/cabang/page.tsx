'use client'
import { useEffect, useState } from 'react'
import Shell from '../../components/Shell'
import Icon from '../../components/Icon'
import PageHead from '../../components/PageHead'
import { useDialog } from '../../components/Dialog'
import { supabase } from '../../lib/supabase'
import { loadMe } from '../../lib/auth'

const ZONA: [string, string][] = [['Asia/Jakarta', 'WIB'], ['Asia/Makassar', 'WITA'], ['Asia/Jayapura', 'WIT']]
function Cabang() {
  const dlg = useDialog()
  const [rows, setRows] = useState<any[]>([])
  const [ppl, setPpl] = useState<any[]>([])
  const [me, setMe] = useState<any>(null)
  const [f, setF] = useState({ kode: '', nama: '', alamat: '', tz: 'Asia/Jakarta' })
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
    setErr(error ? (error.code === '23505' ? 'Kode cabang sudah dipakai' : error.message) : ''); if (!error) { setF({ kode: '', nama: '', alamat: '', tz: 'Asia/Jakarta' }); load() }
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
  async function ubahTz(r: any, tz: string) {
    if (!(await dlg.confirm({ title: `Ubah zona waktu ${r.kode}?`, message: 'Batas hari untuk stok, rekap, dan laporan cabang ini akan bergeser. Ubah hanya jika zona waktunya memang salah.', okText: 'Ubah' }))) return load()
    const { error } = await supabase.from('cabang').update({ tz }).eq('id', r.id)
    if (error) await dlg.alert({ title: 'Gagal mengubah zona waktu', message: error.message, tone: 'danger', icon: 'close' })
    load()
  }
  async function setRmdm(id: string, v: string) { await supabase.from('cabang').update({ rmdm_id: v || null }).eq('id', id); load() }
  return (<>
    <PageHead title="Cabang" desc="Kelola cabang, zona waktunya (WIB, WITA, WIT), dan RMDM yang mencover." />
    <section className="card" aria-label="Tambah cabang">
      <div className="row" style={{ margin: 0, alignItems: 'flex-end' }}>
        <label className="fld" style={{ margin: 0, maxWidth: 140 }}><span className="label">Kode (4 digit)</span><input value={f.kode} maxLength={4} inputMode="numeric" onChange={e => setF({ ...f, kode: e.target.value })} /></label>
        <label className="fld" style={{ margin: 0, flex: 1, minWidth: 180 }}><span className="label">Nama cabang</span><input value={f.nama} onChange={e => setF({ ...f, nama: e.target.value })} /></label>
        <label className="fld" style={{ margin: 0, flex: 2, minWidth: 220 }}><span className="label">Alamat</span><input value={f.alamat} onChange={e => setF({ ...f, alamat: e.target.value })} /></label>
        <label className="fld" style={{ margin: 0 }}><span className="label">Zona waktu</span><select value={f.tz} onChange={e => setF({ ...f, tz: e.target.value })}>{ZONA.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
        <button onClick={add}><Icon name="plus" size={18} /> Tambah cabang</button>
      </div>
      {err && <p className="err" role="alert" style={{ margin: '12px 0 0' }}>{err}</p>}
    </section>
    <div className="scroll"><table>
      <thead><tr><th>Kode</th><th>Nama</th><th>Alamat</th><th>Zona waktu</th><th>MDS</th><th>RMDM</th><th /></tr></thead>
      <tbody>{rows.map(r => <tr key={r.id}>
        <td>{r.kode}</td><td>{r.nama}</td><td>{r.alamat}</td>
        <td><select value={r.tz || 'Asia/Jakarta'} aria-label={`Zona waktu ${r.kode}`} onChange={e => ubahTz(r, e.target.value)}>{ZONA.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></td><td>{nm(r.mds_id)}</td>
        <td>{me?.role === 'mdm'
          ? <select value={r.rmdm_id || ''} onChange={e => setRmdm(r.id, e.target.value)}><option value="">-</option>{ppl.filter(x => x.role === 'rmdm').map(x => <option key={x.id} value={x.id}>{x.nama}</option>)}</select>
          : nm(r.rmdm_id)}</td>
        <td><div className="aksi"><button className="ghost small" onClick={() => edit(r)}><Icon name="edit" size={16} /> Edit</button><button className="ghost danger small" onClick={() => del(r)}><Icon name="trash" size={16} /> Hapus</button></div></td>
      </tr>)}</tbody>
    </table></div>
  </>)
}
export default function Page() { return <Shell roles={['mdm', 'rmdm']}><Cabang /></Shell> }
