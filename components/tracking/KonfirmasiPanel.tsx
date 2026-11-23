'use client'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import PilihanOpsi, { OPSI_STATUS, OPSI_YA_TIDAK } from './PilihanOpsi'
import Icon from '../Icon'
import { supabase } from '../../lib/supabase'
import { friendly } from '../../lib/friendly'
import { ambilPosisi, formatJarak, INDIKATOR, jarakM, RADIUS_M, TEMUAN_PETUNJUK, type Indikator, type KunciIndikator, type Stop, type Titik } from '../../lib/trackinggo'

const kosong = (): Indikator => ({ status: '', keterangan: '' })
type YT = 'ya' | 'tidak' | ''

function Isian({ no, judul, petunjuk, catatan, nilai, onUbah, disabled }: { no: number; judul: string; petunjuk: string; catatan?: string; nilai: Indikator; onUbah: (v: Indikator) => void; disabled?: boolean }) {
  const id = useId()
  return (
    <div className="tg-q">
      <b className="tg-lbl" id={id}><span className="tg-qn" aria-hidden="true">{no}</span>{judul}</b>
      {catatan && <p className="tg-na">{catatan}</p>}
      <details className="tg-acuan"><summary>Lihat acuan penilaian</summary><p className="tg-petunjuk">{petunjuk}</p></details>
      <PilihanOpsi label={judul} nilai={nilai.status} opsi={OPSI_STATUS} disabled={disabled} onPilih={s => onUbah({ ...nilai, status: s })} />
      <textarea className="tg-ta" aria-label={`Keterangan ${judul}`} rows={2} placeholder="Keterangan (opsional)" value={nilai.keterangan} disabled={disabled} onChange={e => onUbah({ ...nilai, keterangan: e.target.value })} />
    </div>)
}

const sing = (s: Indikator | undefined) => (s?.status === 'Sesuai' ? 'S' : s?.status || '-')

// Satu stop di rute: nama outlet yang bisa diketuk, ringkasan hasil bila sudah dikonfirmasi, dan formulir konfirmasi bila belum.
// Konfirmasi hanya bisa dilakukan sekali per kunjungan dan harus di dekat outlet; jaraknya dihitung di database dari titik GPS yang dikirim.
// detail = alamat, jam, penjualan, dan tombol navigasi: ditaruh di antara nama outlet dan formulir. bukaOtomatis = formulir langsung terbuka (outlet pertama yang belum dikonfirmasi).
export default function KonfirmasiPanel({ stop, indeks, posisi, onTersimpan, detail, bukaOtomatis, nomor }: { stop: Stop; indeks: number; nomor?: number; posisi: Titik | null; onTersimpan: () => void; detail?: ReactNode; bukaOtomatis?: boolean }) {
  const [buka, setBuka] = useState(false)
  const akar = useRef<HTMLDivElement>(null), sudahMuat = useRef(false)
  useEffect(() => {
    if (bukaOtomatis) { setBuka(true); if (sudahMuat.current) akar.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
    sudahMuat.current = true
  }, [bukaOtomatis])
  const pertama = stop.pertama
  const [ada, setAda] = useState<YT>(''), [sesuai, setSesuai] = useState<YT>('')
  const [ind, setInd] = useState<Record<KunciIndikator, Indikator>>(() => ({
    jam_kunjungan: pertama ? kosong() : { status: 'N/A', keterangan: `Toko Ke-${indeks + 1}` }, on_rayon: kosong(), kunjungan_manual: kosong(), pv_satu: kosong() }))
  const [temuan, setTemuan] = useState(''), [diskusi, setDiskusi] = useState('')
  const [simpan, setSimpan] = useState(false), [galat, setGalat] = useState('')
  const k = stop.konfirmasi
  const jarak = posisi && stop.lat != null && stop.lng != null ? jarakM(posisi.lat, posisi.lng, stop.lat, stop.lng) : null

  const wajibInd = INDIKATOR.filter(d => pertama || d.key !== 'jam_kunjungan')
  const total = 2 + wajibInd.length, terjawab = (ada ? 1 : 0) + (sesuai ? 1 : 0) + wajibInd.filter(d => ind[d.key].status).length

  async function kirim() {
    setGalat('')
    if (!ada || !sesuai) return setGalat('Jawab dulu apakah toko ada dan apakah penjualannya sesuai.')
    const wajib = INDIKATOR.filter(d => pertama || d.key !== 'jam_kunjungan')
    if (wajib.some(d => !ind[d.key].status)) return setGalat('Isi status (Sesuai / TS / N/A) untuk semua indikator dulu.')
    setSimpan(true)
    try {
      let titik: Titik | null = null
      if (stop.lat != null && stop.lng != null) titik = await ambilPosisi()   // outlet punya koordinat: lokasi Anda wajib terbaca
      const { error } = await supabase.rpc('backtrack_simpan', {
        p_visit: stop.visitId, p_lat: titik?.lat ?? null, p_lng: titik?.lng ?? null, p_acc: titik?.acc ?? null,
        p_data: { toko_ada: ada === 'ya', penjualan_sesuai: sesuai === 'ya', ...ind, temuan_lain: temuan, hasil_diskusi: diskusi } })
      if (error) throw error
      setBuka(false); onTersimpan()
    } catch (e) { setGalat(friendly(e, 'Gagal menyimpan konfirmasi.')) } finally { setSimpan(false) }
  }

  return (
    <div ref={akar} className="tg-panel">
      <button type="button" className="tg-nama" aria-expanded={buka} onClick={() => setBuka(v => !v)}>
        {nomor != null && <span className="tg-no" aria-hidden="true">{nomor}</span>}
        <span className="tg-judul">{stop.nama}
          {jarak != null && <span className={`tg-pill${jarak <= RADIUS_M ? ' ok' : ''}`}>{formatJarak(jarak)} dari Anda</span>}
          {k && <span className="tg-pill ok">Sudah dikonfirmasi</span>}</span>
        <Icon name={buka ? 'up' : 'down'} size={18} />
      </button>
      {k && <div className="tg-hasil"><Icon name="check" size={14} /> Toko ada: {k.toko_ada ? 'Ya' : 'Tidak'} · Penjualan sesuai: {k.penjualan_sesuai ? 'Ya' : 'Tidak'} · Jam: {sing(k.jam_kunjungan)} · On Rayon: {sing(k.on_rayon)} · Manual: {sing(k.kunjungan_manual)} · PV≤1: {sing(k.pv_satu)} — oleh {k.oleh_nama || '-'}{k.jarak_m != null ? ` (${k.jarak_m} m dari outlet)` : ''}</div>}
      {detail}
      {buka && k && <p className="muted" style={{ fontSize: 13, margin: '8px 0 0' }}>Hasil konfirmasi tidak bisa diubah. Jika keliru, minta MDM atau RMDM menghapusnya di menu Riwayat, lalu isi ulang.</p>}
      {buka && !k && (
        <div className="tg-form">
          <div className="tg-q"><b className="tg-lbl"><span className="tg-qn" aria-hidden="true">1</span>Apakah toko ada?</b><PilihanOpsi label="Apakah toko ada?" nilai={ada} opsi={OPSI_YA_TIDAK} onPilih={setAda} /></div>
          <div className="tg-q"><b className="tg-lbl"><span className="tg-qn" aria-hidden="true">2</span>Apakah penjualannya sudah sesuai dilakukan di toko?</b><PilihanOpsi label="Apakah penjualannya sesuai?" nilai={sesuai} opsi={OPSI_YA_TIDAK} onPilih={setSesuai} /></div>
          {INDIKATOR.map((d, i) => (
            <Isian key={d.key} no={i + 3} judul={d.judul} nilai={ind[d.key]} disabled={d.key === 'jam_kunjungan' && !pertama}
              petunjuk={d.petunjuk} catatan={d.key === 'jam_kunjungan' && !pertama ? 'Otomatis N/A karena bukan toko pertama yang dikunjungi hari itu.' : undefined}
              onUbah={v => setInd(s => ({ ...s, [d.key]: v }))} />))}
          <div className="tg-q"><b className="tg-lbl">Temuan Lain saat di Toko</b><details className="tg-acuan"><summary>Lihat acuan penilaian</summary><p className="tg-petunjuk">{TEMUAN_PETUNJUK}</p></details>
            <textarea className="tg-ta" aria-label="Temuan lain" rows={2} placeholder="Opsional" value={temuan} maxLength={1000} onChange={e => setTemuan(e.target.value)} /></div>
          <div className="tg-q"><b className="tg-lbl">Hasil diskusi dengan Salesman atas ketidaksesuaian (DKS vs Hasil Back Track)</b>
            <textarea className="tg-ta" aria-label="Hasil diskusi" rows={2} placeholder="Opsional" value={diskusi} maxLength={1000} onChange={e => setDiskusi(e.target.value)} /></div>
          <p className="fhint">Konfirmasi hanya bisa disimpan saat Anda berada di outlet (maksimal {RADIUS_M} m). Lokasi dicek saat menekan Simpan.</p>
          {galat && <p className="err" role="alert">{galat}</p>}
          <div className="tg-aksi tg-sticky">
            <span className="tg-prog" aria-live="polite">Terjawab <b>{terjawab}/{total}</b></span>
            <button type="button" onClick={kirim} disabled={simpan} aria-busy={simpan}>{simpan ? 'Mengecek lokasi dan menyimpan…' : 'Simpan konfirmasi'}</button>
            <button type="button" className="ghost" onClick={() => setBuka(false)} disabled={simpan}>Batal</button>
          </div>
        </div>)}
    </div>)
}
