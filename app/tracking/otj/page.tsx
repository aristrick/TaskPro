'use client'
import { useEffect, useMemo, useState } from 'react'
import Shell from '../../../components/Shell'
import PageHead from '../../../components/PageHead'
import Empty from '../../../components/Empty'
import Icon from '../../../components/Icon'
import Combobox, { type Opsi } from '../../../components/Combobox'
import { useDialog } from '../../../components/Dialog'
import ChecklistOtj from '../../../components/tracking/ChecklistOtj'
import { supabase } from '../../../lib/supabase'
import { friendly } from '../../../lib/friendly'
import { unduhBuffer } from '../../../lib/excel'
import { day, jam, fetchAll, OFFSET, TZ } from '../../../lib/rekap'
import { OTJ_TEMPLATES, butirBagian, skorButir, skorPersen, skorTotal, type JawabanMap, type KunciBagian, type TipeOtj } from '../../../lib/otj-template'
import { batasWaktu } from '../../../lib/trackinggo'
import { buatXlsxOtj, namaFileOtj, type RekamOtj } from '../../../lib/trackinggo-excel'
import { belumMigrasi22, useTrackingData } from '../../../lib/use-tracking'

type Tahap = 'pra' | 'kunjungan' | 'pasca' | 'selesai'
type Toko = { outlet_id: number | null; outlet_nama: string; jawaban: JawabanMap }
type Catatan = Record<KunciBagian, string>
const LANGKAH: [Tahap, string][] = [['pra', 'Pra-Kunjungan'], ['kunjungan', 'Selama Kunjungan'], ['pasca', 'Pasca-Kunjungan'], ['selesai', 'Selesai']]
const kosongCatatan = (): Catatan => ({ pra: '', kunjungan: '', pasca: '' })
type Draf = { tahap: Tahap; tipe: TipeOtj; divisi: string; cab: string; fl: string; tgl: string; pra: JawabanMap; pasca: JawabanMap; toko: Toko[]; akar: Catatan; plan: Catatan }

function Penanda({ tahap }: { tahap: Tahap }) {
  const aktif = LANGKAH.findIndex(l => l[0] === tahap)
  return <div className="tg-steps" aria-label="Tahap OTJ">{LANGKAH.map(([k, t], i) => <div key={k} style={{ display: 'contents' }}>
    <div className={`tg-step${i < aktif ? ' sudah' : i === aktif ? ' on' : ''}`} aria-current={i === aktif ? 'step' : undefined}><i>{i < aktif ? <Icon name="check" size={16} /> : i + 1}</i>{t}</div>
    {i < LANGKAH.length - 1 && <div className={`tg-garis${i < aktif ? ' sudah' : ''}`} />}</div>)}</div>
}
const Skor = ({ v }: { v: number | null }) => <b style={{ color: 'var(--navy)' }}>{v == null ? '-' : `${v}%`}</b>

function Catat({ k, akar, plan, setAkar, setPlan, judul }: { k: KunciBagian; akar: Catatan; plan: Catatan; setAkar: (c: Catatan) => void; setPlan: (c: Catatan) => void; judul: string }) {
  return <div className="tg-grid" style={{ marginTop: 12 }}>
    <label><span className="tg-lbl">Akar Masalah {judul}</span><textarea className="tg-ta" rows={2} maxLength={1000} value={akar[k]} onChange={e => setAkar({ ...akar, [k]: e.target.value })} /></label>
    <label><span className="tg-lbl">Action Plan {judul}</span><textarea className="tg-ta" rows={2} maxLength={1000} value={plan[k]} onChange={e => setPlan({ ...plan, [k]: e.target.value })} /></label></div>
}

function Otj() {
  const dlg = useDialog()
  const { me, cabs, fls, siap } = useTrackingData()
  const hariIni = day(new Date())
  const [tahap, setTahap] = useState<Tahap>('pra')
  const [tipe, setTipe] = useState<TipeOtj>('Taskforce')
  const t = OTJ_TEMPLATES[tipe]
  const [divisi, setDivisi] = useState(t.divisiOptions[0])
  const [cab, setCab] = useState(''), [fl, setFl] = useState(''), [tgl, setTgl] = useState(hariIni)
  const [pra, setPra] = useState<JawabanMap>({}), [pasca, setPasca] = useState<JawabanMap>({})
  const [toko, setToko] = useState<Toko[]>([])
  const [tokoBaru, setTokoBaru] = useState<{ id: number; nama: string } | null>(null), [jawabBaru, setJawabBaru] = useState<JawabanMap>({})
  const [akar, setAkar] = useState<Catatan>(kosongCatatan()), [plan, setPlan] = useState<Catatan>(kosongCatatan())
  const [simpan, setSimpan] = useState(false), [pesan, setPesan] = useState(''), [migrasi, setMigrasi] = useState(false)
  const [hasil, setHasil] = useState<RekamOtj | null>(null), [unduh, setUnduh] = useState(false)
  const [outletOpsi, setOutletOpsi] = useState<Opsi[]>([]), [drafAda, setDrafAda] = useState(false)
  const kunci = me ? `taskpro-otj-draf-${me.id}` : ''

  const butirPra = butirBagian(t, 'pra'), butirKun = butirBagian(t, 'kunjungan'), butirPasca = butirBagian(t, 'pasca')
  const pilihanFl = useMemo(() => fls.filter(f => f.cabang_id === cab), [fls, cab])
  const flObj = fls.find(f => f.id === fl), cabObj = cabs.find(c => c.id === cab)

  useEffect(() => { if (cabs.length === 1) setCab(cabs[0].id) }, [cabs])
  useEffect(() => { if (fl && !pilihanFl.some(f => f.id === fl)) setFl('') }, [pilihanFl, fl])

  // Draf tersimpan di perangkat ini supaya isian tidak hilang bila halaman dimuat ulang. Dipulihkan sekali setelah akun dikenali.
  useEffect(() => {
    if (!kunci) return
    try {
      const s = localStorage.getItem(kunci); if (!s) return
      const d = JSON.parse(s) as Draf
      if (!OTJ_TEMPLATES[d.tipe] || d.tahap === 'selesai') return
      setTipe(d.tipe); setDivisi(d.divisi); setCab(d.cab); setFl(d.fl); setTgl(d.tgl); setPra(d.pra); setPasca(d.pasca); setToko(d.toko); setAkar(d.akar); setPlan(d.plan); setTahap(d.tahap); setDrafAda(true)
    } catch { /* draf rusak diabaikan */ }
  }, [kunci])
  useEffect(() => {
    if (!kunci || tahap === 'selesai' || !fl) return
    try { localStorage.setItem(kunci, JSON.stringify({ tahap, tipe, divisi, cab, fl, tgl, pra, pasca, toko, akar, plan } satisfies Draf)) } catch { /* penyimpanan penuh/ditolak */ }
  }, [kunci, tahap, tipe, divisi, cab, fl, tgl, pra, pasca, toko, akar, plan])
  const hapusDraf = () => { try { if (kunci) localStorage.removeItem(kunci) } catch { /* abaikan */ } }

  // Pilihan toko: yang dikunjungi frontliner pada tanggal itu (dari data kunjungan TaskPro) di atas, lalu semua outlet milik frontliner.
  useEffect(() => {
    setOutletOpsi([])
    if (!flObj || tahap !== 'kunjungan') return
    let batal = false
    ;(async () => {
      try {
        const tz = cabs.find(c => c.id === flObj.cabang_id)?.tz || TZ, { a: awal, b: akhir } = batasWaktu(tgl, tgl, OFFSET[tz] || '+07:00')
        const kunj = await fetchAll((a, b) => supabase.from('visits').select('outlet_id,checkin_at,cabang(tz),outlets(code,name)').eq('frontliner_id', flObj.id).gte('checkin_at', awal).lt('checkin_at', akhir).order('checkin_at').range(a, b))
        const harian = kunj as { outlet_id: number; checkin_at: string; cabang: { tz: string } | null; outlets: { code: string | null; name: string } | null }[]
        const outlets = await fetchAll((a, b) => supabase.from('outlets').select('id,code,name,address').eq('kode_md', flObj.user_id).order('name').range(a, b))
        if (batal) return
        const sudah = new Set<number>(), atas: Opsi[] = harian.filter(v => !sudah.has(v.outlet_id) && sudah.add(v.outlet_id)).map(v => ({ value: String(v.outlet_id), label: v.outlets?.name || `Outlet ${v.outlet_id}`, sub: `Dikunjungi ${jam(v.checkin_at, v.cabang?.tz).slice(0, 5)} · ${v.outlets?.code || ''}` }))
        const sisa: Opsi[] = (outlets as { id: number; code: string | null; name: string; address: string | null }[]).filter(o => !sudah.has(o.id)).map(o => ({ value: String(o.id), label: o.name, sub: `${o.code || ''} · ${o.address || ''}` }))
        setOutletOpsi([...atas, ...sisa])
      } catch { /* daftar kosong: pengguna tetap diberi tahu di bawah */ }
    })()
    return () => { batal = true }
  }, [flObj, tgl, tahap, cabs])

  function gantiTipe(b: TipeOtj) { setTipe(b); setDivisi(OTJ_TEMPLATES[b].divisiOptions[0]); setPra({}); setPasca({}); setToko([]); setTokoBaru(null); setJawabBaru({}); setAkar(kosongCatatan()); setPlan(kosongCatatan()) }
  function ulang() { hapusDraf(); setTahap('pra'); setFl(''); setTgl(hariIni); setPra({}); setPasca({}); setToko([]); setTokoBaru(null); setJawabBaru({}); setAkar(kosongCatatan()); setPlan(kosongCatatan()); setHasil(null); setPesan(''); setDrafAda(false) }

  async function keKunjungan() {
    setPesan('')
    if (!cab) return setPesan('Pilih cabang dulu.')
    if (!fl) return setPesan('Pilih nama yang dinilai dulu.')
    if (!await dlg.confirm({ title: 'Selesai Pra-Kunjungan?', icon: 'check', okText: 'Ya, lanjut ke kunjungan', message: 'Pastikan checklist Pra-Kunjungan sudah lengkap dan benar. Setelah lanjut, bagian ini TIDAK BISA diedit lagi.' })) return
    setTahap('kunjungan')
  }
  function tambahToko() {
    setPesan('')
    if (!tokoBaru) return setPesan('Pilih toko dulu sebelum ditambahkan.')
    if (toko.some(x => x.outlet_id === tokoBaru.id)) return setPesan('Toko ini sudah ada di daftar.')
    setToko(l => [...l, { outlet_id: tokoBaru.id, outlet_nama: tokoBaru.nama, jawaban: jawabBaru }]); setTokoBaru(null); setJawabBaru({})
  }
  async function kePasca() {
    setPesan('')
    if (toko.length === 0) return setPesan('Tambahkan minimal 1 toko yang dikunjungi dulu.')
    if (!await dlg.confirm({ title: 'Selesai isi kunjungan?', icon: 'check', okText: 'Ya, lanjut ke pasca-kunjungan', message: `${toko.length} toko sudah ditambahkan. Setelah lanjut, daftar toko ini TIDAK BISA diubah lagi.` })) return
    setTahap('pasca')
  }
  async function selesai() {
    setPesan('')
    if (!await dlg.confirm({ title: 'Simpan hasil OTJ?', icon: 'check', tone: 'danger', okText: 'Ya, simpan sekarang', message: 'Setelah disimpan, seluruh hasil OTJ hari ini TIDAK BISA diedit lagi. Pastikan checklist Pasca-Kunjungan sudah benar.' })) return
    if (!flObj || !cabObj || !me) return
    const skor = skorTotal(t, pra, toko.map(x => ({ jawaban: x.jawaban })), pasca)
    setSimpan(true)
    try {
      const { error } = await supabase.rpc('otj_simpan', { p: { tipe, divisi, cabang_id: cab, frontliner_id: fl, tanggal: tgl, jawaban_pra: pra, jawaban_pasca: pasca, kunjungan: toko, akar_masalah: akar, action_plan: plan, skor } })
      if (error) throw error
      hapusDraf(); setDrafAda(false)
      setHasil({ tipe, divisi, frontliner: flObj.nama, cabang: cabObj.nama, tanggal: tgl, dinilaiOleh: me.nama, skor, jawabanPra: pra, jawabanPasca: pasca, kunjungan: toko.map(x => ({ outletNama: x.outlet_nama, jawaban: x.jawaban })), akarMasalah: akar, actionPlan: plan })
      setTahap('selesai')
    } catch (e) {
      const m = e instanceof Error ? e.message : (e as { message?: string })?.message
      if (belumMigrasi22(m)) setMigrasi(true); else setPesan(friendly(e, 'Gagal menyimpan hasil OTJ.'))
    } finally { setSimpan(false) }
  }
  async function unduhExcel() {
    if (!hasil) return
    setUnduh(true)
    try { const { buffer } = await buatXlsxOtj(t, hasil); unduhBuffer(namaFileOtj(hasil), buffer) } catch (e) { setPesan(friendly(e, 'Gagal membuat file Excel.')) } finally { setUnduh(false) }
  }

  if (siap && cabs.length === 0) return <><PageHead title="OTJ" /><Empty icon="alert" title="Belum ada cabang untuk akun ini">Minta MDM mengatur cabang akun Anda.</Empty></>
  return (<div className="tg-sempit">
    <PageHead title="OTJ (On the Job Assessment)" desc="Isi bertahap: Pra-Kunjungan, Selama Kunjungan (per toko), lalu Pasca-Kunjungan. Tiap tahap terkunci setelah dikonfirmasi selesai." />
    {migrasi && <Empty icon="alert" title="Database belum siap untuk Tracking Go">Jalankan <b>22_migration.sql</b> sekali di Supabase &gt; SQL Editor, lalu coba simpan lagi.</Empty>}
    {drafAda && tahap !== 'selesai' && <div className="notice warn" role="status"><span>Draf OTJ yang belum selesai dipulihkan dari perangkat ini.</span><button type="button" className="ghost" onClick={ulang}>Hapus draf</button></div>}
    <Penanda tahap={tahap} />
    {tahap !== 'selesai' && fl && <div className="chips" style={{ marginBottom: 12 }}><span className="chip">{flObj?.nama}</span><span className="chip">{cabObj?.nama}</span><span className="chip">{tipe} / {divisi}</span><span className="chip">{tgl}</span></div>}
    {pesan && <div className="notice bad" role="alert">{pesan}</div>}

    {tahap === 'pra' && <>
      <div className="seg segsm" role="group" aria-label="Tipe OTJ" style={{ marginBottom: 12 }}>{(Object.keys(OTJ_TEMPLATES) as TipeOtj[]).map(k => <button key={k} type="button" className={tipe === k ? 'on' : ''} aria-pressed={tipe === k} onClick={() => gantiTipe(k)}>{k}</button>)}</div>
      <section className="card"><div className="tg-grid">
        <label><span className="tg-lbl">Cabang</span><select style={{ width: '100%' }} value={cab} onChange={e => setCab(e.target.value)} disabled={cabs.length === 1}><option value="">Pilih cabang</option>{cabs.map(c => <option key={c.id} value={c.id}>{c.kode} · {c.nama}</option>)}</select></label>
        <label><span className="tg-lbl">Nama dinilai (frontliner)</span><select style={{ width: '100%' }} value={fl} onChange={e => setFl(e.target.value)} disabled={!cab}><option value="">{cab ? 'Pilih frontliner' : 'Pilih cabang dulu'}</option>{pilihanFl.map(f => <option key={f.id} value={f.id}>{f.user_id} · {f.nama}</option>)}</select></label>
        <label><span className="tg-lbl">Divisi</span><select style={{ width: '100%' }} value={divisi} onChange={e => setDivisi(e.target.value)}>{t.divisiOptions.map(d => <option key={d}>{d}</option>)}</select></label>
        <label><span className="tg-lbl">Tanggal</span><input type="date" style={{ width: '100%' }} value={tgl} max={hariIni} onChange={e => setTgl(e.target.value)} /></label></div></section>
      <section className="card"><h3>{t.sections[0].title} <Skor v={skorButir(butirPra, pra)} /></h3>
        <ChecklistOtj butir={butirPra} jawab={pra} onJawab={(id, v) => setPra(s => ({ ...s, [id]: v }))} />
        <Catat k="pra" akar={akar} plan={plan} setAkar={setAkar} setPlan={setPlan} judul="" /></section>
      <button type="button" style={{ width: '100%' }} onClick={keKunjungan}>Lanjut ke kunjungan</button></>}

    {tahap !== 'pra' && <div className="tg-ringkas"><span><Icon name="check" size={14} /> Pra-Kunjungan terkunci</span><Skor v={skorButir(butirPra, pra)} /></div>}

    {tahap === 'kunjungan' && <>
      <section className="card"><h3>{t.sections[1].title}</h3><p className="muted">{toko.length} toko sudah ditambahkan.</p>
        {toko.map((x, i) => <div className="tg-ringkas" key={i}><span>{i + 1}. {x.outlet_nama} <Skor v={skorButir(butirKun, x.jawaban)} /></span>
          <button type="button" className="ghost danger" onClick={() => setToko(l => l.filter((_, j) => j !== i))}>Hapus</button></div>)}
        <div className="tg-form"><b>Tambah toko yang dikunjungi</b>
          {tokoBaru
            ? <div className="tg-ringkas" style={{ background: '#fff' }}><span><b>{tokoBaru.nama}</b></span><button type="button" className="ghost" onClick={() => setTokoBaru(null)}>Ganti</button></div>
            : <><Combobox label="Cari toko" placeholder="Cari nama atau ID outlet…" opsi={outletOpsi} kosong="Tidak ada outlet yang cocok" onPilih={v => { const o = outletOpsi.find(x => x.value === v); if (o) setTokoBaru({ id: Number(o.value), nama: o.label }) }} />
              {outletOpsi.length === 0 && <p className="fhint">Belum ada outlet untuk frontliner ini di TaskPro (atau masih dimuat).</p>}</>}
          <ChecklistOtj butir={butirKun} jawab={jawabBaru} onJawab={(id, v) => setJawabBaru(s => ({ ...s, [id]: v }))} />
          <div className="tg-aksi"><button type="button" onClick={tambahToko}><Icon name="plus" size={16} /> Tambahkan toko ini</button></div></div>
        <Catat k="kunjungan" akar={akar} plan={plan} setAkar={setAkar} setPlan={setPlan} judul="(Section B)" /></section>
      <button type="button" style={{ width: '100%' }} onClick={kePasca}>Lanjut ke pasca-kunjungan</button></>}

    {(tahap === 'pasca' || tahap === 'selesai') && <div className="tg-ringkas"><span><Icon name="check" size={14} /> Selama Kunjungan terkunci · {toko.length} toko</span><Skor v={skorPersen(toko.flatMap(x => butirKun.map(b => x.jawaban[b.id])))} /></div>}

    {tahap === 'pasca' && <>
      <section className="card"><h3>{t.sections[2].title} <Skor v={skorButir(butirPasca, pasca)} /></h3>
        <ChecklistOtj butir={butirPasca} jawab={pasca} onJawab={(id, v) => setPasca(s => ({ ...s, [id]: v }))} />
        <Catat k="pasca" akar={akar} plan={plan} setAkar={setAkar} setPlan={setPlan} judul="" /></section>
      <button type="button" style={{ width: '100%' }} onClick={selesai} disabled={simpan} aria-busy={simpan}>{simpan ? 'Menyimpan…' : 'Simpan OTJ hari ini'}</button></>}

    {tahap === 'selesai' && hasil && <section className="card tg-tengah">
      <h3>OTJ hari ini tersimpan</h3>
      <p className="muted">{hasil.frontliner} · {hasil.cabang} · {hasil.kunjungan.length} toko</p>
      <div className="tg-skor">{hasil.skor == null ? '-' : `${hasil.skor}%`}</div>
      <div className="tg-aksi" style={{ justifyContent: 'center' }}>
        <button type="button" className="ghost" onClick={unduhExcel} disabled={unduh} aria-busy={unduh}><Icon name="download" size={16} /> Unduh Excel</button>
        <button type="button" onClick={ulang}>Isi OTJ baru</button></div></section>}
  </div>)
}
export default function Page() { return <Shell roles={['mds', 'mdm', 'rmdm', 'tl', 'kormot']}><Otj /></Shell> }
