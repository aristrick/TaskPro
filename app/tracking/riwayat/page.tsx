'use client'
import { useCallback, useEffect, useState } from 'react'
import Shell from '../../../components/Shell'
import PageHead from '../../../components/PageHead'
import Empty from '../../../components/Empty'
import Icon from '../../../components/Icon'
import { SkelRows } from '../../../components/Loaders'
import { useDialog } from '../../../components/Dialog'
import { supabase } from '../../../lib/supabase'
import { friendly } from '../../../lib/friendly'
import { unduhBuffer, unduhXlsx } from '../../../lib/excel'
import { dt } from '../../../lib/rekap'
import { namaFile, type KonfirmasiRow } from '../../../lib/trackinggo'
import { OTJ_TEMPLATES, type JawabanMap, type TipeOtj } from '../../../lib/otj-template'
import { buatXlsxOtj, namaFileOtj } from '../../../lib/trackinggo-excel'
import { belumMigrasi22, useTrackingData } from '../../../lib/use-tracking'

const BATAS = 300
type Tab = 'bt' | 'otj'
type BtRow = KonfirmasiRow & { cabang: { nama: string } | null }
type OtjRow = { id: string; tipe: TipeOtj; divisi: string; cabang_id: string; frontliner_nama: string; tanggal: string; jawaban_pra: JawabanMap; jawaban_pasca: JawabanMap
  kunjungan: { outlet_id: number | null; outlet_nama: string; jawaban: JawabanMap }[]; akar_masalah: Record<string, string>; action_plan: Record<string, string>; skor: number | null
  oleh_nama: string; created_at: string; cabang: { nama: string } | null }

const Status = ({ s }: { s?: string }) => !s ? <>-</> : <span className={`tg-pill${s === 'Sesuai' ? ' ok' : s === 'TS' ? ' bad' : ''}`}>{s}</span>

function Riwayat() {
  const dlg = useDialog()
  const { me, cabs, siap } = useTrackingData()
  const [tab, setTab] = useState<Tab>('bt')
  const [cab, setCab] = useState(''), [tgl, setTgl] = useState('')
  const [bt, setBt] = useState<BtRow[] | null>(null), [otj, setOtj] = useState<OtjRow[] | null>(null)
  const [galat, setGalat] = useState(''), [migrasi, setMigrasi] = useState(false), [pesan, setPesan] = useState('')
  const boleh = me?.role === 'mdm' || me?.role === 'rmdm'   // sama dengan kebijakan hapus di database

  const muat = useCallback(async () => {
    if (!siap) return
    setGalat(''); setBt(null); setOtj(null)
    let q = tab === 'bt' ? supabase.from('backtrack_konfirmasi').select('*,cabang(nama)') : supabase.from('otj_penilaian').select('*,cabang(nama)')
    if (cab) q = q.eq('cabang_id', cab)
    if (tgl) q = q.eq(tab === 'bt' ? 'visit_date' : 'tanggal', tgl)
    const { data, error } = await q.order('created_at', { ascending: false }).limit(BATAS)
    if (error) { if (belumMigrasi22(error.message)) setMigrasi(true); else setGalat(friendly(error)); tab === 'bt' ? setBt([]) : setOtj([]); return }
    if (tab === 'bt') setBt((data ?? []) as BtRow[]); else setOtj((data ?? []) as OtjRow[])
  }, [siap, tab, cab, tgl])
  useEffect(() => { muat() }, [muat])

  async function hapus(tabel: 'backtrack_konfirmasi' | 'otj_penilaian', id: string, ket: string) {
    if (!await dlg.confirm({ title: 'Hapus riwayat ini?', icon: 'trash', tone: 'danger', okText: 'Hapus', message: `${ket}. Penghapusan tidak bisa dibatalkan dan tercatat di Jejak Audit.` })) return
    const { data, error } = await supabase.from(tabel).delete().eq('id', id).select('id')
    if (error || !data?.length) return setPesan(error ? friendly(error) : 'Tidak ada yang terhapus. Anda tidak berwenang atas data ini.')
    setPesan(''); muat()
  }
  async function unduhOtj(r: OtjRow) {
    try {
      const { buffer } = await buatXlsxOtj(OTJ_TEMPLATES[r.tipe], { tipe: r.tipe, divisi: r.divisi, frontliner: r.frontliner_nama, cabang: r.cabang?.nama || '', tanggal: r.tanggal, dinilaiOleh: r.oleh_nama, skor: r.skor,
        jawabanPra: r.jawaban_pra, jawabanPasca: r.jawaban_pasca, kunjungan: r.kunjungan.map(k => ({ outletNama: k.outlet_nama, jawaban: k.jawaban })), akarMasalah: r.akar_masalah, actionPlan: r.action_plan })
      unduhBuffer(namaFileOtj({ tipe: r.tipe, frontliner: r.frontliner_nama, tanggal: r.tanggal } as Parameters<typeof namaFileOtj>[0]), buffer)
    } catch (e) { setPesan(friendly(e, 'Gagal membuat file Excel.')) }
  }
  async function unduhSemua() {
    if (tab === 'bt' && bt) await unduhXlsx(`Riwayat_BackTracking${tgl ? '_' + namaFile(tgl) : ''}.xlsx`, 'Back Tracking', bt.map(r => ({ 'Tanggal Kunjungan': r.visit_date, 'Tanggal Back Tracking': dt(r.created_at), Cabang: r.cabang?.nama || '', Outlet: r.outlet_nama || '', 'Outlet ID': r.outlet_kode || '', Frontliner: r.frontliner_nama || '',
      'Toko Ada': r.toko_ada ? 'Ya' : 'Tidak', 'Penjualan Sesuai': r.penjualan_sesuai ? 'Ya' : 'Tidak', 'Jam Kunjungan': r.jam_kunjungan?.status, 'On Rayon': r.on_rayon?.status, 'Kunjungan Manual': r.kunjungan_manual?.status, 'PV ≤ 1': r.pv_satu?.status,
      'Jarak GPS (m)': r.jarak_m ?? '', 'Temuan Lain': r.temuan_lain, 'Hasil Diskusi': r.hasil_diskusi, 'Dikonfirmasi Oleh': r.oleh_nama || '' })))
    if (tab === 'otj' && otj) await unduhXlsx(`Riwayat_OTJ${tgl ? '_' + namaFile(tgl) : ''}.xlsx`, 'OTJ', otj.map(r => ({ Tanggal: r.tanggal, Tipe: r.tipe, Divisi: r.divisi, Frontliner: r.frontliner_nama, Cabang: r.cabang?.nama || '', 'Jumlah Toko': r.kunjungan?.length || 0, 'Nilai Total (%)': r.skor ?? '', 'Dinilai Oleh': r.oleh_nama })))
  }

  const rows = tab === 'bt' ? bt : otj, penuh = !!rows && rows.length >= BATAS
  return (<>
    <PageHead title="Riwayat" desc="Hasil konfirmasi Back Tracking dan hasil OTJ yang pernah disimpan, sesuai cabang yang menjadi wewenang Anda.">
      <button type="button" className="ghost" onClick={unduhSemua} disabled={!rows?.length}><Icon name="download" size={16} /> Unduh Excel</button></PageHead>
    {migrasi && <Empty icon="alert" title="Database belum siap untuk Tracking Go">Jalankan <b>22_migration.sql</b> sekali di Supabase &gt; SQL Editor, lalu muat ulang halaman ini.</Empty>}
    <div className="seg" role="tablist" style={{ maxWidth: 360, marginBottom: 12 }}>
      {([['bt', 'Back Tracking'], ['otj', 'OTJ']] as [Tab, string][]).map(([k, t]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t}</button>)}</div>
    <div className="row">
      {cabs.length > 1 && <select aria-label="Cabang" value={cab} onChange={e => setCab(e.target.value)}><option value="">Semua cabang</option>{cabs.map(c => <option key={c.id} value={c.id}>{c.kode} · {c.nama}</option>)}</select>}
      <input type="date" aria-label={tab === 'bt' ? 'Tanggal kunjungan' : 'Tanggal OTJ'} value={tgl} onChange={e => setTgl(e.target.value)} />
      {tgl && <button type="button" className="ghost" onClick={() => setTgl('')}>Semua tanggal</button>}
    </div>
    {galat && <div className="notice bad" role="alert">{galat}</div>}
    {pesan && <div className="notice bad" role="alert">{pesan}</div>}
    {penuh && <div className="notice warn" role="status">Menampilkan {BATAS} data terbaru. Pilih tanggal atau cabang untuk mempersempit.</div>}
    {rows === null ? <SkelRows n={5} /> : rows.length === 0 ? <Empty icon="list" title={tab === 'bt' ? 'Belum ada riwayat Back Tracking' : 'Belum ada riwayat OTJ'}>Hasil yang disimpan akan muncul di sini.</Empty>
      : tab === 'bt' ? <div className="scroll"><table className="tg-tabel"><thead><tr><th>Tgl kunjungan</th><th>Tgl back tracking</th><th>Outlet</th><th>Frontliner</th><th>Toko ada?</th><th>Penjualan sesuai?</th><th>Jam</th><th>On rayon</th><th>Manual</th><th>PV ≤ 1</th><th>Jarak GPS</th><th>Temuan lain</th><th>Hasil diskusi</th><th>Oleh</th>{boleh && <th><span className="sr-only">Aksi</span></th>}</tr></thead>
        <tbody>{(bt ?? []).map(r => <tr key={r.id}><td>{r.visit_date}</td><td>{dt(r.created_at)}</td><td><b>{r.outlet_nama}</b><div className="muted" style={{ fontSize: 12 }}>{r.outlet_kode}</div></td><td>{r.frontliner_nama}<div className="muted" style={{ fontSize: 12 }}>{r.cabang?.nama}</div></td>
          <td>{r.toko_ada ? 'Ya' : 'Tidak'}</td><td>{r.penjualan_sesuai ? 'Ya' : 'Tidak'}</td><td><Status s={r.jam_kunjungan?.status} /></td><td><Status s={r.on_rayon?.status} /></td><td><Status s={r.kunjungan_manual?.status} /></td><td><Status s={r.pv_satu?.status} /></td>
          <td>{r.jarak_m != null ? `${r.jarak_m} m` : '-'}</td><td style={{ maxWidth: 200 }}>{r.temuan_lain || '-'}</td><td style={{ maxWidth: 200 }}>{r.hasil_diskusi || '-'}</td><td>{r.oleh_nama}</td>
          {boleh && <td><button type="button" className="ghost danger" aria-label={`Hapus konfirmasi ${r.outlet_nama}`} onClick={() => hapus('backtrack_konfirmasi', r.id, `Konfirmasi ${r.outlet_nama} (${r.visit_date})`)}><Icon name="trash" size={16} /></button></td>}</tr>)}</tbody></table></div>
      : <div className="scroll"><table className="tg-tabel"><thead><tr><th>Tanggal</th><th>Tipe</th><th>Divisi</th><th>Frontliner</th><th>Cabang</th><th>Jumlah toko</th><th>Nilai total</th><th>Dinilai oleh</th><th><span className="sr-only">Aksi</span></th></tr></thead>
        <tbody>{(otj ?? []).map(r => <tr key={r.id}><td>{r.tanggal}</td><td>{r.tipe}</td><td>{r.divisi || '-'}</td><td><b>{r.frontliner_nama}</b></td><td>{r.cabang?.nama || '-'}</td><td>{r.kunjungan?.length || 0}</td><td>{r.skor == null ? '-' : `${r.skor}%`}</td><td>{r.oleh_nama}</td>
          <td><div className="tg-aksi"><button type="button" className="ghost" onClick={() => unduhOtj(r)}><Icon name="download" size={16} /> Excel</button>
            {boleh && <button type="button" className="ghost danger" aria-label={`Hapus OTJ ${r.frontliner_nama}`} onClick={() => hapus('otj_penilaian', r.id, `OTJ ${r.frontliner_nama} (${r.tanggal})`)}><Icon name="trash" size={16} /></button>}</div></td></tr>)}</tbody></table></div>}
  </>)
}
export default function Page() { return <Shell roles={['mds', 'mdm', 'rmdm', 'tl', 'kormot']}><Riwayat /></Shell> }
