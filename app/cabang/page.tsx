'use client'
import { useEffect, useState } from 'react'
import Shell from '../../components/Shell'
import Icon from '../../components/Icon'
import PageHead from '../../components/PageHead'
import { useDialog } from '../../components/Dialog'
import { supabase } from '../../lib/supabase'
import { loadMe } from '../../lib/auth'
import MenuAksi from '../../components/ui/MenuAksi'
import SidePanel from '../../components/ui/SidePanel'

const ZONA: [string, string][] = [['Asia/Jakarta', 'WIB'], ['Asia/Makassar', 'WITA'], ['Asia/Jayapura', 'WIT']]
function Cabang() {
  const dlg = useDialog()
  const [rows, setRows] = useState<any[]>([])
  const [ppl, setPpl] = useState<any[]>([])
  const [me, setMe] = useState<any>(null)
  const [f, setF] = useState({ kode: '', nama: '', alamat: '', tz: 'Asia/Jakarta' })
  const [err, setErr] = useState('')
  const [buka, setBuka] = useState(false)
  async function load() {
    const { data } = await supabase.from('cabang').select('*').order('kode'); setRows(data || [])
    const { data: p } = await supabase.from('profiles').select('id,nama,role').in('role', ['mds', 'rmdm']); setPpl(p || [])
  }
  useEffect(() => { load(); loadMe().then(({ me }) => setMe(me)) }, [])
  const nm = (id: string) => ppl.find(x => x.id === id)?.nama || '-'
  async function add() {
    if (!/^[0-9]{4}$/.test(f.kode) || !f.nama.trim() || !f.alamat.trim()) return setErr('Kode harus 4 digit, nama dan alamat wajib diisi')
    const { error } = await supabase.from('cabang').insert({ ...f, rmdm_id: me?.role === 'rmdm' ? me.id : null }) // RMDM otomatis mengcover cabang buatannya
    setErr(error ? (error.code === '23505' ? 'Kode cabang sudah dipakai' : error.message) : ''); if (!error) { setF({ kode: '', nama: '', alamat: '', tz: 'Asia/Jakarta' }); setBuka(false); load() }
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
    <PageHead title="Cabang" desc="Kelola cabang, zona waktunya (WIB, WITA, WIT), dan RMDM yang mencover.">
      <button onClick={() => { setErr(''); setBuka(true) }}><Icon name="plus" size={18} /> Tambah</button>
    </PageHead>
    {buka && <SidePanel judul="Tambah cabang" onClose={() => setBuka(false)}>
      <div className="formstack">
        <label className="fld"><span className="label">Kode (4 digit)</span><input value={f.kode} maxLength={4} inputMode="numeric" onChange={e => setF({ ...f, kode: e.target.value })} /></label>
        <label className="fld"><span className="label">Nama cabang</span><input value={f.nama} onChange={e => setF({ ...f, nama: e.target.value })} /></label>
        <label className="fld"><span className="label">Alamat</span><input value={f.alamat} onChange={e => setF({ ...f, alamat: e.target.value })} /></label>
        <label className="fld"><span className="label">Zona waktu</span><select value={f.tz} onChange={e => setF({ ...f, tz: e.target.value })}>{ZONA.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
      </div>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row" style={{ justifyContent: 'flex-end', margin: 0 }}><button className="ghost" onClick={() => setBuka(false)}>Batal</button><button onClick={add}><Icon name="plus" size={18} /> Tambah cabang</button></div>
    </SidePanel>}
    <div className="scroll"><table>
      <thead><tr><th>Kode</th><th>Nama</th><th>Alamat</th><th>Zona waktu</th><th>MDS</th><th>RMDM</th><th /></tr></thead>
      <tbody>{rows.map(r => <tr key={r.id}>
        <td className="nowrap">{r.kode}</td><td>{r.nama}</td><td>{r.alamat}</td>
        <td><select value={r.tz || 'Asia/Jakarta'} aria-label={`Zona waktu ${r.kode}`} onChange={e => ubahTz(r, e.target.value)}>{ZONA.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></td><td>{nm(r.mds_id)}</td>
        <td>{me?.role === 'mdm'
          ? <select aria-label={`RMDM untuk cabang ${r.kode}`} value={r.rmdm_id || ''} onChange={e => setRmdm(r.id, e.target.value)}><option value="">-</option>{ppl.filter(x => x.role === 'rmdm').map(x => <option key={x.id} value={x.id}>{x.nama}</option>)}</select>
          : nm(r.rmdm_id)}</td>
        <td className="td-aksi"><MenuAksi label={`Aksi untuk cabang ${r.kode}`} items={[{ label: 'Edit cabang', icon: 'edit', onClick: () => edit(r) }, { label: 'Hapus cabang', icon: 'trash', danger: true, onClick: () => del(r) }]} /></td>
      </tr>)}</tbody>
    </table></div>
  </>)
}
export default function Page() { return <Shell roles={['mdm', 'rmdm']}><Cabang /></Shell> }
