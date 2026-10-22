'use client'
import { useEffect, useState } from 'react'
import Shell from '../../components/Shell'
import Icon from '../../components/Icon'
import { useDialog } from '../../components/Dialog'
import { useUndo } from '../../components/UndoToast'
import { supabase } from '../../lib/supabase'
import { loadMe } from '../../lib/auth'
import { api } from '../../lib/api'
import { useAktif } from '../../lib/sesi'
import { jam } from '../../lib/rekap'
import AkunCard, { type Akun, type Cabang, type Konfirmasi } from '../../components/mds/AkunCard'

type Filter = 'all' | 'rmdm' | 'mds' | 'mdm'

const EMPTY = { role: 'mds', user_id: '', nama: '', password: '', cabang_id: '' }

function Mds() {
  const dlg = useDialog(), undo = useUndo()
  const [list, setList] = useState<Akun[]>([])
  const [cabang, setCabang] = useState<Cabang[]>([])
  const [f, setF] = useState(EMPTY)
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const [role, setRole] = useState('')
  const [aktif, refreshAktif] = useAktif()
  const [buka, setBuka] = useState(false)
  const [q, setQ] = useState(''); const [rf, setRf] = useState<Filter>('all')
  async function load() {
    const { data: p } = await supabase.from('profiles').select('id,user_id,nama,role').in('role', ['mds', 'rmdm', 'mdm']).order('user_id')
    const { data: c } = await supabase.from('cabang').select('id,kode,nama,mds_id,rmdm_id').order('kode')
    setList(p || []); setCabang(c || [])
  }
  useEffect(() => { load(); loadMe().then(({ me }) => setRole(me?.role || '')) }, [])
  const bebasMds = cabang.filter(c => !c.mds_id), bebasR = cabang.filter(c => !c.rmdm_id)
  const cb = (c: Cabang) => `${c.kode} ${c.nama}`

  async function create() {
    setErr('')
    if (!f.user_id.trim() || !f.nama.trim() || !f.password) return setErr('User ID, nama, dan password wajib diisi')
    if (f.role === 'mds' && !f.cabang_id) return setErr('Pilih 1 cabang untuk MDS ini')
    setBusy(true); const e = await api('/api/mds', 'POST', f); setBusy(false); setErr(e)
    if (!e) { setF({ ...EMPTY, role: f.role }); setBuka(false); await load(); dlg.alert({ title: 'Akun dibuat', tone: 'ok', message: <>Akun <b>{f.user_id.trim().toUpperCase()}</b> berhasil dibuat.</> }) }
  }
  async function remove(m: Akun) {
    if (!(await dlg.confirm({ title: `Hapus akun ${m.role.toUpperCase()}?`, tone: 'danger', okText: 'Hapus', message: <><b>{m.nama}</b> ({m.user_id}) akan dihapus. Cabang yang dipegang akan kembali kosong.</> }))) return
    const e = await api('/api/mds', 'DELETE', { id: m.id }); if (e) await dlg.alert({ title: 'Gagal menghapus', message: e, tone: 'danger', icon: 'close' }); load()
  }
  async function op(body: Record<string, unknown>, konfirmasi?: Konfirmasi, tanpaUndo = false) {
    if (konfirmasi && !(await dlg.confirm({ ...konfirmasi, okText: 'Ya, lanjut' }))) return
    const e = await api('/api/mds', 'PATCH', body)
    if (e) await dlg.alert({ title: 'Gagal menyimpan', message: e, tone: 'danger', icon: 'close' })
    else if (!tanpaUndo && (body.op === 'rmdm_add' || body.op === 'rmdm_remove')) {   // menambah/melepas cakupan RMDM bisa dibalik: beri tombol Urungkan
      const c = cabang.find(x => x.id === body.cabang_id), r = list.find(x => x.id === body.id), nm = c ? `${c.kode} ${c.nama}` : 'Cabang'
      undo.tampil(body.op === 'rmdm_add' ? `${nm} ditambahkan ke ${r?.nama || 'RMDM'}.` : `${nm} dilepas dari ${r?.nama || 'RMDM'}.`,
        () => op({ id: body.id, op: body.op === 'rmdm_add' ? 'rmdm_remove' : 'rmdm_add', cabang_id: body.cabang_id }, undefined, true))
    }
    load()
  }
  async function paksa(m: Akun) {
    if (!(await dlg.confirm({ title: 'Logout paksa?', icon: 'logout', tone: 'danger', okText: 'Logout paksa', message: <><b>{m.nama}</b> akan dikeluarkan dari semua perangkat dalam hitungan detik.</> }))) return
    const e = await api('/api/sesi', 'POST', { id: m.id }); if (e) await dlg.alert({ title: 'Gagal', message: e, tone: 'danger', icon: 'close' }); refreshAktif()
  }
  const status = (m: Akun) => aktif[m.id]
    ? <><span className="on-badge">Aktif</span><span className="off-badge">terakhir {jam(aktif[m.id]).slice(0, 5)}</span></>
    : <span className="off-badge">Tidak aktif</span>

  const cabangText = (m: Akun) => cabang.filter(c => (m.role === 'mds' ? c.mds_id : c.rmdm_id) === m.id).map(cb).join(' ')
  const cocok = (m: Akun) => { const t = q.trim().toLowerCase(); return !t || `${m.nama} ${m.user_id} ${cabangText(m)}`.toLowerCase().includes(t) }
  const jml = (r: string) => list.filter(m => m.role === r).length
  const grup: [string, string][] = [['rmdm', 'RMDM'], ['mds', 'MDS'], ...(role === 'mdm' ? [['mdm', 'MDM'] as [string, string]] : [])]
  const tampil = grup.filter(([k]) => rf === 'all' || rf === k).map(([k, nm]) => [k, nm, list.filter(m => m.role === k && cocok(m))] as const).filter(([, , it]) => it.length)

  const DESK: Record<string, string> = { rmdm: 'Mencover banyak cabang', mds: 'Memegang 1 cabang', mdm: 'Pengelola utama' }
  const jmlTab = (k: string) => k === 'all' ? grup.reduce((a, [g]) => a + jml(g), 0) : jml(k)
  const tabs: [Filter, string][] = [['all', 'Semua'], ['rmdm', 'RMDM'], ['mds', 'MDS'], ...(role === 'mdm' ? [['mdm', 'MDM'] as [Filter, string]] : [])]

  return (<>
    <div className="pagehead">
      <div><h2>MDS &amp; RMDM</h2><p className="muted pgdesc">Kelola akun supervisor dan cabang yang mereka pegang.</p></div>
      <button onClick={() => setBuka(v => !v)} aria-expanded={buka} aria-controls="form-akun">{buka ? <><Icon name="close" size={16} /> Tutup form</> : <><Icon name="plus" size={18} /> Buat akun</>}</button>
    </div>

    {buka && <section className="card page" id="form-akun" aria-label="Buat akun baru">
      <div className="sech-in"><h3>Buat akun baru</h3>
        <div className="seg segsm" role="tablist" aria-label="Role akun">
          <button role="tab" aria-selected={f.role === 'mds'} className={f.role === 'mds' ? 'on' : ''} onClick={() => setF({ ...f, role: 'mds', cabang_id: '' })}>MDS · 1 cabang</button>
          {role === 'mdm' && <button role="tab" aria-selected={f.role === 'rmdm'} className={f.role === 'rmdm' ? 'on' : ''} onClick={() => setF({ ...f, role: 'rmdm', cabang_id: '' })}>RMDM · banyak cabang</button>}
        </div></div>
      <div className="formgrid">
        <label className="fld"><span className="label">User ID</span><input placeholder="mis. 0300-MDS01" value={f.user_id} autoCapitalize="characters" onChange={e => setF({ ...f, user_id: e.target.value })} /><small className="fhint">Dipakai untuk login</small></label>
        <label className="fld"><span className="label">Nama</span><input placeholder="Nama lengkap" value={f.nama} onChange={e => setF({ ...f, nama: e.target.value })} /><small className="fhint">Tampil di daftar akun</small></label>
        <label className="fld"><span className="label">Password sementara</span><input value={f.password} placeholder="min. 6 karakter" onChange={e => setF({ ...f, password: e.target.value })} /><small className="fhint">Minimal 6 karakter</small></label>
        {f.role === 'mds' && <label className="fld"><span className="label">Cabang</span>
          <select value={f.cabang_id} onChange={e => setF({ ...f, cabang_id: e.target.value })}><option value="">Pilih cabang…</option>{bebasMds.map(c => <option key={c.id} value={c.id}>{cb(c)}</option>)}</select><small className="fhint">Wajib untuk MDS</small></label>}
      </div>
      {f.role === 'mds' && bebasMds.length === 0 && <p className="hint-box" style={{ margin: '0 0 12px' }}>Semua cabang yang bisa Anda kelola sudah punya MDS. Tambahkan cabang baru di menu Cabang, atau pindahkan MDS lama ke cabang lain.</p>}
      {f.role === 'rmdm' && <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>Cabang yang dicover RMDM diatur setelah akun dibuat (boleh lebih dari satu).</p>}
      {err && <p className="err" role="alert" style={{ margin: '0 0 12px' }}>{err}</p>}
      <div className="row" style={{ justifyContent: 'flex-end', margin: 0 }}>
        <button className="ghost" onClick={() => { setBuka(false); setErr('') }}>Batal</button>
        <button disabled={busy} aria-busy={busy} onClick={create}><Icon name="plus" size={18} /> {busy ? 'Membuat…' : 'Buat akun'}</button></div>
    </section>}

    <div className="toolbar">
      <label className="searchbox"><Icon name="search" size={18} /><input placeholder="Cari nama, User ID, atau cabang…" aria-label="Cari akun" value={q} onChange={e => setQ(e.target.value)} /></label>
      <div className="seg segsm" role="tablist" aria-label="Filter role">
        {tabs.map(([k, t]) => <button key={k} role="tab" aria-selected={rf === k} className={rf === k ? 'on' : ''} onClick={() => setRf(k)}>{t} <span className="tabn">{jmlTab(k)}</span></button>)}</div>
    </div>

    {tampil.length === 0 && <div className="empty"><Icon name="search" size={28} /><b>Tidak ada akun yang cocok</b><p>Coba kata kunci lain{rf !== 'all' ? ' atau pilih filter Semua' : ''}.</p>
      {(q || rf !== 'all') && <button className="ghost" onClick={() => { setQ(''); setRf('all') }}>Hapus pencarian dan filter</button>}</div>}
    {tampil.map(([k, nm, items]) => <section key={k}>
      <div className="grouphead"><h3>{nm}</h3><span className="cnt">{items.length}</span><span className="muted">{DESK[k]}</span></div>
      <div className="accgrid">{items.map(m => <AkunCard key={m.id} m={m} cabang={cabang} bebasMds={bebasMds} bebasR={bebasR} viewerRole={role} status={status(m)} bisaPaksa={!!aktif[m.id]}
        onHapus={() => remove(m)} onPaksa={() => paksa(m)} onOp={op} />)}</div>
    </section>)}
    {undo.node}
  </>)
}
export default function Page() { return <Shell roles={['mdm', 'rmdm']}><Mds /></Shell> }
