'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TipBantuan from '../../components/ui/TipBantuan'
import Shell from '../../components/Shell'
import PageHead from '../../components/PageHead'
import Empty from '../../components/Empty'
import Combobox, { type Opsi } from '../../components/Combobox'
import WeekBoard from '../../components/schedule/WeekBoard'
import Ringkasan from '../../components/schedule/Ringkasan'
import Icon from '../../components/Icon'
import ProfilCard from '../../components/schedule/ProfilCard'
import RayonPicker from '../../components/schedule/RayonPicker'
import { SkelRows } from '../../components/Loaders'
import { useDialog } from '../../components/Dialog'
import { useUndo } from '../../components/UndoToast'
import { supabase } from '../../lib/supabase'
import { loadMe } from '../../lib/auth'
import { dt, fetchAll } from '../../lib/rekap'
import { friendly } from '../../lib/friendly'
import { HARI, MINGGU, adalahSenin, hariAwal, hariIniDi, hariTerisi, kodeRayon, labelHari, perRayon, seninDari, tambahHari, tanggalPanjang, type Baris, type OutletJadwal } from '../../lib/jadwal'

type Cab = { id: string; kode: string; nama: string; tz: string; schedule_start: string | null }
type Fl = { id: string; user_id: string; nama: string; cabang_id: string; project_id: string | null; schedule_locked: boolean }
type Detail = { rows: Baris[]; outlets: OutletJadwal[]; last: string | null; posisi: { minggu: number; hari: number } | null }
const KUNCI_PILIH = 'taskpro-schedule-fl'

// Schedule Taskforce: jadwal kunjungan per frontliner. 4 minggu x Senin–Sabtu; tiap hari diisi rayon yang dikunjungi hari itu.
// MDS, RMDM, dan MDM mengisi jadwal. Kunci jadwal (frontliner tidak bisa memilih rayon) hanya untuk MDM dan RMDM.
function Schedule() {
  const dlg = useDialog(), undo = useUndo()
  const [role, setRole] = useState('')
  const [cabang, setCabang] = useState<Cab[]>([])
  const [fls, setFls] = useState<Fl[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [ready, setReady] = useState(false)
  const [belumMigrasi, setBelumMigrasi] = useState(false)
  const [gagal, setGagal] = useState('')
  const [sel, setSel] = useState('')
  const [det, setDet] = useState<Detail | null>(null)
  const [muat, setMuat] = useState(false)
  const [tab, setTab] = useState<number | null>(null)          // 1–4 = satu minggu, 0 = ringkasan 4 minggu, null = minggu berjalan
  const [hariSel, setHariSel] = useState<number | null>(null)  // hari (1–6) yang rincian outletnya dibuka; null = otomatis (hari ini / hari terisi pertama)
  const [picker, setPicker] = useState<{ minggu: number; hari: number } | null>(null)
  const req = useRef(0)

  const fl = fls.find(x => x.id === sel)
  const cab = cabang.find(c => c.id === fl?.cabang_id)
  const bisaKunci = role === 'mdm' || role === 'rmdm'

  async function loadDasar() {
    const c = await supabase.from('cabang').select('id,kode,nama,tz,schedule_start').order('kode')
    if (c.error) { if (/schedule_start|42703/.test(`${c.error.code} ${c.error.message}`)) setBelumMigrasi(true); else setGagal(friendly(c.error, 'Gagal memuat cabang')); return setReady(true) }
    const [f, p] = await Promise.all([
      supabase.from('profiles').select('id,user_id,nama,cabang_id,project_id,schedule_locked').eq('role', 'frontliner').order('user_id'),
      supabase.from('projects').select('id,name')])
    if (f.error) { if (/schedule_locked|42703/.test(`${f.error.code} ${f.error.message}`)) setBelumMigrasi(true); else setGagal(friendly(f.error, 'Gagal memuat frontliner')); return setReady(true) }
    setCabang((c.data || []) as Cab[]); setFls((f.data || []) as Fl[]); setProjects(p.data || []); setReady(true)
  }
  useEffect(() => { loadMe().then(({ me }) => setRole(me?.role || '')); loadDasar() }, [])  

  // Frontliner pertama dipilih otomatis (atau yang terakhir dibuka di perangkat ini) supaya halaman tidak kosong.
  useEffect(() => {
    if (sel || !fls.length) return
    let awal = ''; try { awal = sessionStorage.getItem(KUNCI_PILIH) || '' } catch { /* abaikan */ }
    setSel(fls.some(x => x.id === awal) ? awal : fls[0].id)
  }, [fls, sel])

  const muatDetail = useCallback(async (f: Fl, c: Cab | undefined, diam = false) => {
    const n = ++req.current
    if (!diam) setMuat(true)
    try {
      const [j, o, v, ps] = await Promise.all([
        supabase.from('schedule_taskforce').select('id,minggu,hari,rayon').eq('frontliner_id', f.id),
        fetchAll((a, b) => supabase.from('outlets').select('id,ext_id,name,address,rayon').eq('kode_md', f.user_id).eq('status', 'AKTIF').order('id').range(a, b)),
        supabase.from('visits').select('checkin_at').eq('frontliner_id', f.id).order('checkin_at', { ascending: false }).limit(1),
        supabase.rpc('schedule_posisi', { p_cabang: f.cabang_id })])
      if (n !== req.current) return   // frontliner lain sudah dipilih selagi menunggu: abaikan hasil lama
      if (j.error) throw j.error
      const pos = Array.isArray(ps.data) ? ps.data[0] : ps.data
      setDet({ rows: (j.data || []) as Baris[], outlets: o as OutletJadwal[], last: v.data?.[0]?.checkin_at ? dt(v.data[0].checkin_at, c?.tz) : null,
        posisi: pos && typeof pos.minggu === 'number' ? { minggu: pos.minggu, hari: pos.hari } : null })
    } catch (e) { if (n === req.current) { setDet(null); await dlg.alert({ title: 'Gagal memuat jadwal', message: friendly(e), tone: 'danger', icon: 'close' }) } }
    if (n === req.current) setMuat(false)
  }, [dlg])
  useEffect(() => {
    if (!fl) return
    try { sessionStorage.setItem(KUNCI_PILIH, fl.id) } catch { /* abaikan */ }
    setDet(null); muatDetail(fl, cab)
  }, [sel, fl?.id])   // eslint-disable-line react-hooks/exhaustive-deps

  const per = useMemo(() => perRayon(det?.outlets || []), [det?.outlets])
  const jumlah = useMemo(() => new Map([...per].map(([r, l]) => [r, l.length])), [per])
  const segarkan = () => (fl ? muatDetail(fl, cab, true) : undefined)
  const galat = (title: string, e: unknown) => dlg.alert({ title, message: friendly(e), tone: 'danger', icon: 'close' })

  async function tambah(minggu: number, hari: number, rayon: number) {
    if (!fl) return
    setPicker(null)
    const { error } = await supabase.rpc('schedule_tambah', { p_frontliner: fl.id, p_minggu: minggu, p_hari: hari, p_rayon: rayon })
    if (error) return void galat('Rayon belum bisa ditambahkan', error)
    setTab(minggu); setHariSel(hari)   // langsung tampilkan hari yang baru diisi agar hasilnya terlihat
    await segarkan()
    undo.tampil(`${kodeRayon(rayon)} ditambahkan ke ${labelHari(minggu, hari)}.`, async () => {
      const id = (await supabase.from('schedule_taskforce').select('id').eq('frontliner_id', fl.id).eq('minggu', minggu).eq('hari', hari).eq('rayon', rayon).maybeSingle()).data?.id
      if (id) { await supabase.rpc('schedule_lepas', { p_id: id }); segarkan() }
    })
  }
  async function lepas(b: Baris) {
    if (!fl) return
    const { error } = await supabase.rpc('schedule_lepas', { p_id: b.id })
    if (error) return void galat('Rayon tidak bisa dilepas', error)
    await segarkan()
    undo.tampil(`${kodeRayon(b.rayon)} dilepas dari ${labelHari(b.minggu, b.hari)}.`, async () => { await supabase.rpc('schedule_tambah', { p_frontliner: fl.id, p_minggu: b.minggu, p_hari: b.hari, p_rayon: b.rayon }); segarkan() })
  }
  async function isiUrut() {
    if (!fl) return
    const kosong = MINGGU.flatMap(m => HARI.map((_, i) => ({ m, h: i + 1 }))).filter(x => !(det?.rows || []).some(r => r.minggu === x.m && r.hari === x.h)).length
    if (!kosong) return void dlg.alert({ title: 'Semua hari sudah terisi', message: 'Tidak ada hari yang kosong, jadi tidak ada yang diisi.', icon: 'info' })
    if (!(await dlg.confirm({ title: 'Isi urut R01–R24?', okText: 'Isi', icon: 'list',
      message: <>{kosong} hari yang masih kosong milik <b>{fl.nama}</b> akan diisi berurutan (Minggu 1 Senin = R01 … Minggu 4 Sabtu = R24). Hari yang sudah terisi tidak diubah, dan rayon yang sudah dipakai di hari lain dilewati.</> }))) return
    const { data, error } = await supabase.rpc('schedule_isi_urut', { p_frontliner: fl.id })
    if (error) return void galat('Gagal mengisi jadwal', error)
    await segarkan()
    dlg.alert({ title: 'Jadwal terisi', tone: 'ok', message: <>{Number(data) || 0} hari diisi untuk <b>{fl.nama}</b>.</> })
  }
  async function kunci(v: boolean) {
    if (!fl) return
    if (v && !(await dlg.confirm({ title: 'Kunci jadwal?', icon: 'lock', okText: 'Kunci',
      message: <><b>{fl.nama}</b> tidak akan bisa memilih rayon lagi. Layarnya mengikuti jadwal hari ini, dan check-in di luar rayon jadwal ditolak. Hari tanpa jadwal berarti tidak ada kunjungan.</> }))) return
    const { error } = await supabase.rpc('schedule_kunci', { p_frontliner: fl.id, p_kunci: v })
    if (error) return void galat(v ? 'Jadwal belum bisa dikunci' : 'Kunci belum bisa dibuka', error)
    setFls(l => l.map(x => (x.id === fl.id ? { ...x, schedule_locked: v } : x)))
    undo.tampil(v ? `Jadwal ${fl.nama} dikunci.` : `Kunci jadwal ${fl.nama} dibuka.`, async () => { await supabase.rpc('schedule_kunci', { p_frontliner: fl.id, p_kunci: !v }); setFls(l => l.map(x => (x.id === fl.id ? { ...x, schedule_locked: !v } : x))) })
  }
  async function aturSiklus() {
    if (!cab) return
    const ini = seninDari(hariIniDi(cab.tz)), pilihan = [0, 1, 2, 3].map(n => { const t = tambahHari(ini, -7 * n); return { value: t, label: n === 0 ? `Senin ini (${tanggalPanjang(t)})` : `${n} minggu lalu (${tanggalPanjang(t)})` } })
    const v = await dlg.form({ title: 'Atur awal siklus', okText: 'Simpan', fields: [{ key: 'tgl', label: 'Senin yang menjadi Minggu ke 1 (YYYY-MM-DD)', value: cab.schedule_start || ini, placeholder: '2026-11-02', pilihan }],
      message: <>Berlaku untuk <b>semua frontliner cabang {cab.kode} {cab.nama}</b>. Setelah Minggu ke 4, siklus kembali ke Minggu ke 1.</>,
      validate: x => (adalahSenin(x.tgl.trim()) ? null : 'Tanggal harus berformat YYYY-MM-DD dan jatuh pada hari Senin.') })
    if (!v) return
    const { error } = await supabase.rpc('schedule_set_start', { p_cabang: cab.id, p_tgl: v.tgl.trim() })
    if (error) return void galat('Awal siklus belum tersimpan', error)
    setCabang(l => l.map(x => (x.id === cab.id ? { ...x, schedule_start: v.tgl.trim() } : x))); setTab(null); segarkan()
  }

  const opsi: Opsi[] = fls.map(f => ({ value: f.id, label: f.nama, sub: `${f.user_id}${cabang.length > 1 ? ` · ${cabang.find(c => c.id === f.cabang_id)?.kode || ''}` : ''}${f.schedule_locked ? ' · terkunci' : ''}` }))
  const efektif = tab ?? det?.posisi?.minggu ?? 1
  const hari = det && efektif > 0 ? hariSel ?? hariAwal(det.rows, efektif, det.posisi) : 1
  const idx = fls.findIndex(x => x.id === sel)
  const ganti = (d: number) => { const n = fls[idx + d]; if (n) { setSel(n.id); setTab(null); setHariSel(null) } }
  const pilihFl = <div className="sc-pick">
    <button type="button" className="ghost sc-nav" aria-label="Frontliner sebelumnya" disabled={idx <= 0} onClick={() => ganti(-1)}><Icon name="back" size={18} /></button>
    <Combobox kelas="cari" label="Cari frontliner" placeholder="Cari frontliner (nama atau ID)…" kosong="Frontliner tidak ditemukan" opsi={opsi} onPilih={id => { setSel(id); setTab(null); setHariSel(null) }} />
    <button type="button" className="ghost sc-nav" aria-label="Frontliner berikutnya" disabled={idx < 0 || idx >= fls.length - 1} onClick={() => ganti(1)}><Icon name="chevron" size={18} /></button></div>

  return (<>
    <PageHead title="Schedule Taskforce" desc="Jadwal rayon kunjungan per frontliner: Senin sampai Sabtu selama 4 minggu (24 rayon).">{ready && fls.length > 0 && pilihFl}</PageHead>
    <TipBantuan id="jadwal" judul="Bagaimana jadwal bekerja?"><ul>
        <li>Pilih frontliner, lalu tekan <b>+</b> pada sebuah hari untuk memilih <b>rayon</b> yang dikunjungi hari itu. Daftar outlet (nama dan Outlet ID) mengikuti rayon tersebut.</li>
        <li>Siklus berputar: Minggu ke 1 → 4, lalu kembali ke 1. Posisi hari ini ditandai <b>Hari ini</b>.</li>
        <li><b>Kunci jadwal</b> (MDM dan RMDM): jika menyala, frontliner tidak bisa memilih rayon di HP. Layarnya mengikuti jadwal dan check-in di luar rayon hari itu ditolak. Jika mati, jadwal hanya menjadi petunjuk.</li>
      </ul></TipBantuan>

    {!ready && <SkelRows n={3} />}
    {ready && belumMigrasi && <Empty icon="alert" title="Database belum siap untuk Schedule">Jalankan <b>19_migration.sql</b> sekali di Supabase &gt; SQL Editor, lalu muat ulang halaman ini.</Empty>}
    {ready && gagal && <Empty icon="alert" title="Gagal memuat">{gagal}</Empty>}
    {ready && !belumMigrasi && !gagal && fls.length === 0 && <Empty icon="users" title="Belum ada frontliner">Buat akun frontliner di menu Frontliner, lalu atur jadwalnya di sini.</Empty>}

    {fl && <>
      <ProfilCard nama={fl.nama} userId={fl.user_id} project={projects.find(p => p.id === fl.project_id)?.name} checkin={det?.last || undefined} terkunci={fl.schedule_locked}
        bisaKunci={bisaKunci} onKunci={kunci} posisi={det?.posisi || null} awalSiklus={cab?.schedule_start || null} bisaAtur={bisaKunci} onAtur={aturSiklus} onIsi={isiUrut} bisaUbah={!!det} />
      <div className="sc-tabbar"><div className="sc-tabs" role="tablist" aria-label="Pilih minggu">
        {MINGGU.map(m => <button key={m} type="button" role="tab" aria-selected={efektif === m} className={efektif === m ? 'on' : ''} onClick={() => { setTab(m); setHariSel(null) }}>
          <span>Minggu {m}{det?.posisi?.minggu === m && <><i className="sc-dot" aria-hidden="true" /><span className="sr-only"> (minggu ini)</span></>}</span>
          <small>{det ? hariTerisi(det.rows, m) : 0}/6 hari</small></button>)}
        <button type="button" role="tab" aria-selected={efektif === 0} className={efektif === 0 ? 'on' : ''} onClick={() => setTab(0)}><span>Ringkasan</span><small>4 minggu</small></button>
      </div></div>
      {muat && !det && <SkelRows n={3} />}
      {det && efektif === 0 && <Ringkasan rows={det.rows} posisi={det.posisi} onBuka={(m, h) => { setTab(m); setHariSel(h) }} />}
      {det && efektif > 0 && <WeekBoard minggu={efektif} rows={det.rows} per={per} posisi={det.posisi} hari={hari} onHari={setHariSel} bisaUbah onTambah={h => setPicker({ minggu: efektif, hari: h })} onLepas={lepas} />}
    </>}
    {picker && det && <RayonPicker minggu={picker.minggu} hari={picker.hari} rows={det.rows} jumlah={jumlah} onTutup={() => setPicker(null)} onPilih={r => tambah(picker.minggu, picker.hari, r)} />}
    {undo.node}
  </>)
}
export default function Page() { return <Shell roles={['mds', 'mdm', 'rmdm']}><Schedule /></Shell> }
