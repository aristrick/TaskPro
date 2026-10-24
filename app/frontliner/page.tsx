'use client'
import { useEffect, useState } from 'react'
import Shell from '../../components/Shell'
import Icon from '../../components/Icon'
import { useDialog } from '../../components/Dialog'
import PageHead from '../../components/PageHead'
import Empty from '../../components/Empty'
import { useUndo } from '../../components/UndoToast'
import { supabase } from '../../lib/supabase'
import { loadMe } from '../../lib/auth'
import { api as call } from '../../lib/api'
import { useAktif } from '../../lib/sesi'
import { jam } from '../../lib/rekap'

const api = (method: string, body: any) => call('/api/akun', method, body)

const LABEL: Record<string, string> = { tl: 'TL', kormot: 'Kormot', frontliner: 'Frontliner' }
const EMPTY = { role: 'frontliner', user_id: '', nama: '', password: '', atasan_id: '' }

function Frontliner() {
  const dlg = useDialog(), undo = useUndo()
  const [aktif, refreshAktif] = useAktif()
  const [cabang, setCabang] = useState<any[]>([])
  const [cid, setCid] = useState('')
  const [list, setList] = useState<any[]>([])
  const [f, setF] = useState(EMPTY)
  const [editId, setEditId] = useState('')
  const [err, setErr] = useState('')
  const [role, setRole] = useState('')
  const [buka, setBuka] = useState(false)   // formulir tambah akun tersembunyi sampai dibutuhkan (sama seperti halaman MDS & RMDM)
  const kode = cabang.find(c => c.id === cid)?.kode
  useEffect(() => {
    supabase.from('cabang').select('id,kode,nama').order('kode').then(({ data }) => { setCabang(data || []); if (data?.length) setCid(data[0].id) })
    loadMe().then(({ me }) => setRole(me?.role || ''))
  }, [])
  async function load() {
    if (!cid) return setList([])
    const { data } = await supabase.from('profiles').select('id,user_id,nama,role,atasan_id,gps_required,min_checkout_menit').eq('cabang_id', cid).order('user_id')
    setList(data || [])
  }
  useEffect(() => { load(); setEditId(''); setF(EMPTY); setBuka(false) }, [cid])
  const atasan = list.filter(x => x.role !== 'frontliner')
  const nama = (id: string) => list.find(x => x.id === id)?.nama || '-'
  async function submit() {
    const e = editId ? await api('PATCH', { id: editId, nama: f.nama, password: f.password, atasan_id: f.atasan_id })
                     : await api('POST', { ...f, cabang_id: cid })
    setErr(e); if (!e) { setF(EMPTY); setEditId(''); setBuka(false); load() }
  }
  function edit(x: any) { setBuka(true); setEditId(x.id); setF({ role: x.role, user_id: x.user_id, nama: x.nama, password: '', atasan_id: x.atasan_id || '' }); setErr('') }
  async function setMenit(id: string, n: number) { const e = await api('PATCH', { id, min_checkout_menit: n }); setErr(e); await load(); return !e }
  const labelMenit = (n: number) => (n > 0 ? `${n} menit` : 'Tanpa batas')
  // Mengubah batas check-out selalu lewat dialog: pilih menit, lihat ringkasannya, lalu simpan. Sesudahnya ada tombol Urungkan.
  async function ubahMenit(x: { id: string; user_id: string; nama: string; min_checkout_menit?: number | null }) {
    const lama = Number(x.min_checkout_menit) || 0
    const v = await dlg.form({
      title: 'Batas minimal check-out', okText: 'Simpan batas',
      message: (vals: Record<string, string>) => { const n = Number(vals.menit); return <><b>{x.nama}</b> ({x.user_id}) {vals.menit !== '' && Number.isInteger(n) && n >= 0 && n <= 120 ? (n === 0 ? <>boleh check-out kapan saja setelah check-in.</> : <>baru bisa check-out <b>{n} menit</b> setelah check-in.</>) : <>baru bisa check-out setelah batas yang Anda isi.</>} Saat ini: {labelMenit(lama)}.</> },
      fields: [{ key: 'menit', label: 'Batas (menit, 0 sampai 120)', value: String(lama), inputMode: 'numeric', pilihan: [0, 3, 5, 10, 15, 30].map(n => ({ value: String(n), label: n === 0 ? 'Tanpa batas' : `${n} menit` })) }],
      validate: vals => (/^\d{1,3}$/.test(vals.menit.trim()) && Number(vals.menit) <= 120 ? null : 'Isi bilangan bulat 0 sampai 120.') })
    if (!v) return
    const baru = Number(v.menit)
    if (baru === lama) return
    if (!(await setMenit(x.id, baru))) { await dlg.alert({ title: 'Gagal menyimpan batas check-out', message: 'Coba lagi beberapa saat lagi.', tone: 'danger', icon: 'close' }); return }
    undo.tampil(`Batas check-out ${x.nama} menjadi ${labelMenit(baru)}.`, () => setMenit(x.id, lama))
  }
  async function setGps(id: string, v: boolean) { setErr(await api('PATCH', { id, gps_required: v })); load() }
  async function remove(x: any) {
    if (!(await dlg.confirm({ title: 'Hapus akun ini?', tone: 'danger', okText: 'Hapus', message: <><b>{x.nama}</b> ({x.user_id}) akan dihapus permanen.</> }))) return
    const e = await api('DELETE', { id: x.id }); if (e) await dlg.alert({ title: 'Gagal menghapus', message: e, tone: 'danger', icon: 'close' }); load()
  }
  async function paksa(x: any) {
    if (!(await dlg.confirm({ title: 'Logout paksa?', icon: 'logout', tone: 'danger', okText: 'Logout paksa', message: <><b>{x.nama}</b> akan dikeluarkan dari perangkatnya dalam hitungan detik.</> }))) return
    const e = await call('/api/sesi', 'POST', { id: x.id }); if (e) await dlg.alert({ title: 'Gagal', message: e, tone: 'danger', icon: 'close' }); refreshAktif()
  }
  const tampil = !!cid
  return (<>
    <PageHead title="Frontliner" desc="Kelola akun frontliner, TL, dan Kormot per cabang, termasuk batas check-out dan GPS wajib.">
      <label className="fld-inline"><span className="label">Cabang</span>
        <select value={cid} onChange={e => setCid(e.target.value)}>
          <option value="">Pilih cabang…</option>{cabang.map(c => <option key={c.id} value={c.id}>{c.kode} {c.nama}</option>)}</select></label>
      {tampil && !buka && <button onClick={() => { setBuka(true); setEditId(''); setF(EMPTY); setErr('') }}><Icon name="plus" size={18} /> Tambah akun</button>}
    </PageHead>
    {!tampil && <Empty icon="building" title="Pilih cabang dulu">Daftar akun ditampilkan per cabang.</Empty>}
    {tampil && buka && <section className="card page" aria-label={editId ? 'Edit akun' : 'Tambah akun'}>
      <div className="sech-in"><h3>{editId ? `Edit akun ${f.user_id}` : 'Tambah akun'}</h3></div>
      <div className="formgrid">
        <label className="fld"><span className="label">Role</span><select value={f.role} disabled={!!editId} onChange={e => setF({ ...f, role: e.target.value })}>
          {Object.entries(LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="fld"><span className="label">User ID</span><input placeholder={`mis. ${kode}-TMTB01`} disabled={!!editId} value={f.user_id} onChange={e => setF({ ...f, user_id: e.target.value })} /><small className="fhint">Dipakai untuk login</small></label>
        <label className="fld"><span className="label">Nama</span><input placeholder="Nama lengkap" value={f.nama} onChange={e => setF({ ...f, nama: e.target.value })} /></label>
        <label className="fld"><span className="label">{editId ? 'Password baru' : 'Password sementara'}</span><input placeholder={editId ? 'Kosongkan jika tidak diganti' : 'min. 6 karakter'} value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /></label>
        {f.role === 'frontliner' && <label className="fld"><span className="label">Atasan</span><select value={f.atasan_id} onChange={e => setF({ ...f, atasan_id: e.target.value })}>
          <option value="">Pilih atasan (TL/Kormot)…</option>{atasan.map(a => <option key={a.id} value={a.id}>{a.nama} ({LABEL[a.role]})</option>)}</select></label>}
      </div>
      {err && <p className="err" role="alert" style={{ margin: '0 0 12px' }}>{err}</p>}
      <div className="row" style={{ justifyContent: 'flex-end', margin: 0 }}>
        <button className="ghost" onClick={() => { setBuka(false); setEditId(''); setF(EMPTY); setErr('') }}>Batal</button>
        <button onClick={submit}>{editId ? 'Simpan perubahan' : 'Tambah akun'}</button></div>
    </section>}
    {tampil && !buka && err && <p className="err" role="alert">{err}</p>}
    {tampil && (list.length === 0
      ? <Empty icon="users" title="Belum ada akun di cabang ini">Tambahkan TL atau Kormot lebih dulu, lalu frontliner.</Empty>
      : <div className="scroll"><table className="tfl">
        <colgroup><col /><col className="c-atasan" /><col className="c-gps" /><col className="c-menit" /><col className="c-status" /><col className="c-aksi" /></colgroup>
        <thead><tr><th>Akun</th><th>Atasan</th><th>GPS wajib</th><th title="Jarak waktu minimal dari check-in sampai frontliner boleh check-out. 0 = tanpa batas.">Check-out min.</th><th>Status</th><th><span className="sr-only">Aksi</span></th></tr></thead>
        <tbody>{list.map(x => <tr key={x.id}>
          <td><div className="akun-nama"><b title={x.nama}>{x.nama}</b><span className="akun-sub"><span className={`rb ${x.role}`}>{LABEL[x.role] || x.role.toUpperCase()}</span><small>{x.user_id}</small></span></div></td>
          <td>{x.atasan_id ? nama(x.atasan_id) : <span className="muted">-</span>}</td>
          <td>{x.role !== 'frontliner' ? <span className="muted">-</span> : role === 'mdm'
            ? <label className="switch" title="Matikan untuk mengecualikan frontliner ini dari GPS wajib dan batas 50 m"><input type="checkbox" aria-label={`GPS wajib untuk ${x.nama}`} checked={x.gps_required !== false} onChange={e => setGps(x.id, e.target.checked)} /><span /></label>
            : (x.gps_required === false ? 'Dikecualikan' : 'Wajib')}</td>
          <td>{x.role === 'frontliner'
            ? <button className="menit-btn" onClick={() => ubahMenit(x)} aria-label={`Ubah batas check-out ${x.nama}, sekarang ${labelMenit(Number(x.min_checkout_menit) || 0)}`}><span>{labelMenit(Number(x.min_checkout_menit) || 0)}</span><Icon name="edit" size={14} /></button>
            : <span className="muted">-</span>}</td>
          <td className="stat">{aktif[x.id] ? <><span className="on-badge">Aktif</span><small className="off-badge">{jam(aktif[x.id]).slice(0, 5)}</small></> : <span className="off-badge">Tidak aktif</span>}</td>
          <td><div className="aksi">
            {LABEL[x.role] && <button className="ghost danger small" disabled={!aktif[x.id]} title={aktif[x.id] ? 'Keluarkan akun ini dari perangkatnya' : 'Akun sedang tidak aktif'} onClick={() => paksa(x)}><Icon name="logout" size={16} /> Logout paksa</button>}
            {LABEL[x.role] && <><button className="ghost small" onClick={() => edit(x)}>Edit</button><button className="ghost danger small" onClick={() => remove(x)}>Hapus</button></>}</div></td></tr>)}</tbody>
      </table></div>)}
    {undo.node}
  </>)
}
export default function Page() { return <Shell roles={['mds', 'mdm', 'rmdm']}><Frontliner /></Shell> }
