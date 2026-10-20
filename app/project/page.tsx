'use client'
import { useEffect, useState } from 'react'
import { SkelRows } from '../../components/Loaders'
import Shell from '../../components/Shell'
import Icon from '../../components/Icon'
import { supabase } from '../../lib/supabase'
import { useDialog } from '../../components/Dialog'
import ProjectCard from '../../components/project/ProjectCard'
import { inisial } from '../../components/mds/AkunCard'

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
    <div className="pagehead">
      <div><h2>Project</h2><p className="muted pgdesc">Kelompokkan frontliner ke dalam project dan tentukan produk fokusnya.</p></div>
      {cabang.length > 1 && <label className="fld-inline cabpick"><span className="label">Cabang</span>
        <select value={cid} onChange={e => setCid(e.target.value)}>{cabang.map(c => <option key={c.id} value={c.id}>{c.kode} {c.nama}</option>)}</select></label>}
    </div>
    <details className="infobox">
      <summary>Bagaimana project bekerja?</summary>
      <ul>
        <li>Nama project dipakai untuk kolom <b>Project</b> pada Excel Kunjungan dan Selling.</li>
        <li>Tiap project punya <b>produk fokus</b> sendiri, berlaku untuk semua frontliner di dalamnya. Satu frontliner hanya bisa di satu project.</li>
        <li>Project dan fokus dicatat saat transaksi, jadi riwayat lama tidak berubah jika frontliner pindah project atau fokus diganti.</li>
      </ul>
    </details>

    <section className="card projnew" aria-label="Buat project baru">
      <label className="fld" style={{ margin: 0 }}><span className="label">Project baru{cabang.length === 1 && cid ? ` · ${cabang[0].kode} ${cabang[0].nama}` : ''}</span>
        <div className="projnewrow">
          <input placeholder="mis. Taskforce Beverage Pulogadung Sep 2026" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && buat()} aria-invalid={!!err} />
          <button onClick={buat}><Icon name="plus" size={18} /> Buat project</button></div></label>
      {err && <p className="err" role="alert" style={{ margin: '8px 0 0', fontSize: 14 }}>{err}</p>}
    </section>

    {!ready && <SkelRows n={3} />}
    {ready && cid && inCab.length === 0 && <div className="empty"><Icon name="folder" size={28} /><b>Belum ada project di cabang ini</b><p>Buat project pertama di atas, lalu masukkan frontliner dan pilih produk fokusnya.</p></div>}
    {inCab.map(p => {
      const mem = flCab.filter(f => f.project_id === p.id), other = flCab.filter(f => f.project_id !== p.id)
      const fo = focus.filter(x => x.project_id === p.id).map(x => x.product_id)
      return <ProjectCard key={p.id} p={p} anggota={mem} lainnya={other} fokus={fo} prods={prods} sumber={inCab.filter(x => x.id !== p.id)} namaProject={pname}
        onGanti={() => ganti(p)} onHapus={() => hapus(p)} onAnggota={anggota} onTambahFokus={x => tambahFokus(p.id, x)} onLepasFokus={x => lepasFokus(p.id, x)} onSalin={from => salinFokus(from, p.id)} />
    })}
    {cid && free.length > 0 && <section className="warnbox" aria-label="Frontliner belum masuk project">
      <h4><Icon name="alert" size={18} /> {free.length} frontliner belum masuk project</h4>
      <ul className="tags">{free.map(f => <li className="tag" key={f.id}><span className="tagav" aria-hidden="true">{inisial(f.nama)}</span><span className="tagtx"><b>{f.nama}</b><small>{f.user_id}</small></span></li>)}</ul>
      <p>Kolom Project di Excel untuk frontliner ini akan berisi nama default (TASKFORCE BEVERAGE + nama cabang). Masukkan lewat kartu project di atas.</p></section>}
  </>)
}
export default function Page() { return <Shell roles={['mds', 'mdm', 'rmdm']}><Project /></Shell> }
