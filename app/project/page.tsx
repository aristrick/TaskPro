'use client'
import { useEffect, useState } from 'react'
import { SkelRows } from '../../components/Loaders'
import Shell from '../../components/Shell'
import Icon from '../../components/Icon'
import { supabase } from '../../lib/supabase'
import { useDialog } from '../../components/Dialog'

// Project = nama yang tampil di kolom "Project" pada Excel Kunjungan dan Selling. Satu frontliner hanya di satu project.
function Project() {
  const dlg = useDialog()
  const [cabang, setCabang] = useState<any[]>([])
  const [cid, setCid] = useState('')
  const [projects, setProjects] = useState<any[]>([])
  const [fls, setFls] = useState<any[]>([])
  const [prods, setProds] = useState<any[]>([])
  const [focus, setFocus] = useState<any[]>([])
  const [ready, setReady] = useState(false)
  const [name, setName] = useState('')
  const [err, setErr] = useState('')

  async function load() {
    const [{ data: p }, { data: f }, { data: pr }, { data: fo }] = await Promise.all([
      supabase.from('projects').select('id,name,cabang_id').order('name'),
      supabase.from('profiles').select('id,user_id,nama,cabang_id,project_id').eq('role', 'frontliner').order('user_id'),
      supabase.from('products').select('id,product').eq('active', true).order('product'),
      supabase.from('project_focus').select('project_id,product_id')])
    setProjects(p || []); setFls(f || []); setProds(pr || []); setFocus(fo || []); setReady(true)
  }
  useEffect(() => {
    supabase.from('cabang').select('id,kode,nama').order('kode').then(({ data }) => { setCabang(data || []); if (data?.length) setCid(data[0].id) })
    load()
  }, [])

  const inCab = projects.filter(p => p.cabang_id === cid)
  const flCab = fls.filter(f => f.cabang_id === cid)
  const free = flCab.filter(f => !f.project_id)
  const pname = (id: string) => projects.find(x => x.id === id)?.name

  async function buat() {
    if (!name.trim()) return setErr('Nama project wajib diisi')
    const { error } = await supabase.from('projects').insert({ cabang_id: cid, name: name.trim() })
    setErr(error ? (error.code === '23505' ? 'Nama project ini sudah ada di cabang ini' : error.message) : '')
    if (!error) { setName(''); load() }
  }
  async function ganti(p: any) {
    const v = await dlg.form({ title: 'Ganti nama project', okText: 'Simpan', fields: [{ key: 'name', label: 'Nama project', value: p.name }] })
    if (!v) return
    if (!v.name.trim()) return void dlg.alert({ title: 'Nama kosong', message: 'Nama project wajib diisi.', tone: 'danger', icon: 'close' })
    const { error } = await supabase.from('projects').update({ name: v.name.trim() }).eq('id', p.id)
    if (error) await dlg.alert({ title: 'Gagal menyimpan', message: error.code === '23505' ? 'Nama project ini sudah ada di cabang ini.' : error.message, tone: 'danger', icon: 'close' })
    load()
  }
  async function hapus(p: any) {
    if (!(await dlg.confirm({ title: 'Hapus project?', tone: 'danger', okText: 'Hapus', message: <><b>{p.name}</b> akan dihapus dan semua anggotanya dilepas.</> }))) return
    const { error } = await supabase.from('projects').delete().eq('id', p.id)
    if (error) await dlg.alert({ title: 'Project tidak bisa dihapus', tone: 'danger', icon: 'close',
      message: error.code === '23503' ? 'Project ini sudah tercatat pada data kunjungan. Ganti namanya saja agar riwayat tetap utuh.' : error.message })
    load()
  }
  const pn = (id: string) => prods.find(x => x.id === id)?.product || '-'
  async function tambahFokus(pid: string, prod: string) {
    const { error } = await supabase.from('project_focus').insert({ project_id: pid, product_id: prod })
    setErr(error ? error.message : ''); load()
  }
  async function lepasFokus(pid: string, prod: string) { await supabase.from('project_focus').delete().eq('project_id', pid).eq('product_id', prod); load() }
  async function salinFokus(from: string, to: string) {
    const rows = focus.filter(x => x.project_id === from).map(x => ({ project_id: to, product_id: x.product_id }))
    if (!rows.length) return void dlg.alert({ title: 'Tidak ada yang disalin', message: 'Project sumber belum punya produk fokus.', icon: 'info' })
    const { error } = await supabase.from('project_focus').upsert(rows, { onConflict: 'project_id,product_id', ignoreDuplicates: true })
    setErr(error ? error.message : ''); load()
  }
  async function anggota(fid: string, pid: string | null) {
    const { error } = await supabase.rpc('project_set_member', { p_frontliner: fid, p_project: pid })
    setErr(error ? error.message : ''); load()
  }

  return (<>
    <h2>Project</h2>
    <p className="muted" style={{ marginTop: -4 }}>Nama project dipakai untuk kolom <b>Project</b> pada Excel Kunjungan dan Selling. Tiap project punya <b>produk fokus</b> sendiri, yang berlaku untuk semua frontliner di dalamnya. Project dan fokus dicatat saat transaksi, jadi riwayat lama tidak berubah jika frontliner pindah project atau fokus diganti.</p>
    <div className="card">
      <div className="row" style={{ margin: 0 }}>
        {cabang.length > 1 && <select value={cid} onChange={e => setCid(e.target.value)} aria-label="Cabang">{cabang.map(c => <option key={c.id} value={c.id}>{c.kode} {c.nama}</option>)}</select>}
        <input placeholder="Nama project baru (mis. Taskforce Beverage Pulogadung Sep 2026)" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && buat()} style={{ flex: 1, minWidth: 240 }} />
        <button onClick={buat}><Icon name="plus" size={18} /> Buat project</button></div>
      {err && <p className="err" role="alert" style={{ marginBottom: 0 }}>{err}</p>}
    </div>
    {!ready && <SkelRows n={3} />}
    {ready && cid && inCab.length === 0 && <div className="card muted">Belum ada project di cabang ini. Buat satu di atas, lalu masukkan frontliner.</div>}
    {inCab.map(p => {
      const mem = flCab.filter(f => f.project_id === p.id), other = flCab.filter(f => f.project_id !== p.id)
      const fo = focus.filter(x => x.project_id === p.id).map(x => x.product_id), sumber = inCab.filter(x => x.id !== p.id)
      return (
        <div className="card" key={p.id}>
          <div className="row"><b style={{ fontSize: 16 }}>{p.name}</b><span className="chip">{mem.length} frontliner</span><div className="grow" />
            <button className="ghost" onClick={() => ganti(p)}><Icon name="edit" size={16} /> Ganti nama</button>
            <button className="ghost danger" onClick={() => hapus(p)}><Icon name="trash" size={16} /> Hapus</button></div>
          <div className="row" style={{ marginBottom: 0 }}>
            {mem.map(f => <span className="chip" key={f.id}>{f.user_id} · {f.nama}<a onClick={() => anggota(f.id, null)} title="Keluarkan dari project"> ✕</a></span>)}
            <select value="" aria-label="Tambah frontliner" onChange={e => e.target.value && anggota(e.target.value, p.id)}>
              <option value="">+ Tambah frontliner…</option>
              {other.map(f => <option key={f.id} value={f.id}>{f.user_id} · {f.nama}{f.project_id ? ` (dari ${pname(f.project_id)})` : ''}</option>)}</select></div>
          <div className="row" style={{ margin: '12px 0 0', paddingTop: 12, borderTop: '1px solid var(--line)' }}>
            <span className="label" style={{ width: '100%' }}>Produk fokus ({fo.length})</span>
            {fo.map(x => <span className="chip" key={x}>{pn(x)}<a onClick={() => lepasFokus(p.id, x)} title="Lepas dari fokus"> ✕</a></span>)}
            <select value="" aria-label="Tambah produk fokus" onChange={e => e.target.value && tambahFokus(p.id, e.target.value)}>
              <option value="">+ Tambah produk fokus…</option>{prods.filter(x => !fo.includes(x.id)).map(x => <option key={x.id} value={x.id}>{x.product}</option>)}</select>
            {sumber.length > 0 && <select value="" aria-label="Salin produk fokus" onChange={e => e.target.value && salinFokus(e.target.value, p.id)}>
              <option value="">Salin dari project lain…</option>{sumber.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
          </div>
        </div>)
    })}
    {cid && free.length > 0 && <div className="card"><span className="label">Belum masuk project ({free.length})</span>
      <div className="row" style={{ margin: '8px 0 0' }}>{free.map(f => <span className="chip" key={f.id}>{f.user_id} · {f.nama}</span>)}</div>
      <p className="muted" style={{ margin: '8px 0 0', fontSize: 13 }}>Kolom Project di Excel untuk frontliner ini akan berisi nama default (TASKFORCE BEVERAGE + nama cabang).</p></div>}
  </>)
}
export default function Page() { return <Shell roles={['mds', 'mdm', 'rmdm']}><Project /></Shell> }
