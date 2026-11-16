'use client'
import { useId, useState } from 'react'
import PilihanOpsi, { OPSI_STATUS, OPSI_YA_TIDAK } from './PilihanOpsi'
import Icon from '../Icon'
import { supabase } from '../../lib/supabase'
import { friendly } from '../../lib/friendly'
import { ambilPosisi, formatJarak, INDIKATOR, jarakM, RADIUS_M, TEMUAN_PETUNJUK, type Indikator, type KunciIndikator, type Stop, type Titik } from '../../lib/trackinggo'

const kosong = (): Indikator => ({ status: '', keterangan: '' })
type YT = 'ya' | 'tidak' | ''

function Isian({ judul, petunjuk, nilai, onUbah, disabled }: { judul: string; petunjuk: string; nilai: Indikator; onUbah: (v: Indikator) => void; disabled?: boolean }) {
  const id = useId()
  return (
    <div>
      <b className="tg-lbl" id={id}>{judul}</b>
      <p className="tg-petunjuk">{petunjuk}</p>
      <PilihanOpsi label={judul} nilai={nilai.status} opsi={OPSI_STATUS} disabled={disabled} onPilih={s => onUbah({ ...nilai, status: s })} />
      <textarea className="tg-ta" aria-label={`Keterangan ${judul}`} rows={2} placeholder="Keterangan" value={nilai.keterangan} disabled={disabled} onChange={e => onUbah({ ...nilai, keterangan: e.target.value })} />
    </div>)
}

const sing = (s: Indikator | undefined) => (s?.status === 'Sesuai' ? 'S' : s?.status || '-')

// Satu stop di rute: nama outlet yang bisa diketuk, ringkasan hasil bila sudah dikonfirmasi, dan formulir konfirmasi bila belum.
// Konfirmasi hanya bisa dilakukan sekali per kunjungan dan harus di dekat outlet; jaraknya dihitung di database dari titik GPS yang dikirim.
export default function KonfirmasiPanel({ stop, indeks, posisi, onTersimpan }: { stop: Stop; indeks: number; posisi: Titik | null; onTersimpan: () => void }) {
  const [buka, setBuka] = useState(false)
  const pertama = stop.pertama
  const [ada, setAda] = useState<YT>(''), [sesuai, setSesuai] = useState<YT>('')
  const [ind, setInd] = useState<Record<KunciIndikator, Indikator>>(() => ({
    jam_kunjungan: pertama ? kosong() : { status: 'N/A', keterangan: `Toko Ke-${indeks + 1}` }, on_rayon: kosong(), kunjungan_manual: kosong(), pv_satu: kosong() }))
  const [temuan, setTemuan] = useState(''), [diskusi, setDiskusi] = useState('')
  const [simpan, setSimpan] = useState(false), [galat, setGalat] = useState('')
  const k = stop.konfirmasi
  const jarak = posisi && stop.lat != null && stop.lng != null ? jarakM(posisi.lat, posisi.lng, stop.lat, stop.lng) : null

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
    <div>
      <button type="button" className="tg-nama" aria-expanded={buka} onClick={() => setBuka(v => !v)}>
        <span className="tg-judul">{stop.nama}
          {jarak != null && <span className={`tg-pill${jarak <= RADIUS_M ? ' ok' : ''}`}>{formatJarak(jarak)} dari Anda</span>}
          {k && <span className="tg-pill ok">Sudah dikonfirmasi</span>}</span>
        <Icon name={buka ? 'up' : 'down'} size={18} />
      </button>
      {k && <div className="tg-hasil"><Icon name="check" size={14} /> Toko ada: {k.toko_ada ? 'Ya' : 'Tidak'} · Penjualan sesuai: {k.penjualan_sesuai ? 'Ya' : 'Tidak'} · Jam: {sing(k.jam_kunjungan)} · On Rayon: {sing(k.on_rayon)} · Manual: {sing(k.kunjungan_manual)} · PV≤1: {sing(k.pv_satu)} — oleh {k.oleh_nama || '-'}{k.jarak_m != null ? ` (${k.jarak_m} m dari outlet)` : ''}</div>}
      {buka && k && <p className="muted" style={{ fontSize: 13, margin: '8px 0 0' }}>Hasil konfirmasi tidak bisa diubah. Jika keliru, minta MDM atau RMDM menghapusnya di menu Riwayat, lalu isi ulang.</p>}
      {buka && !k && (
        <div className="tg-form">
          <div><b className="tg-lbl">Apakah toko ada?</b><PilihanOpsi label="Apakah toko ada?" nilai={ada} opsi={OPSI_YA_TIDAK} onPilih={setAda} /></div>
          <div><b className="tg-lbl">Apakah penjualannya sudah sesuai dilakukan di toko?</b><PilihanOpsi label="Apakah penjualannya sesuai?" nilai={sesuai} opsi={OPSI_YA_TIDAK} onPilih={setSesuai} /></div>
          {INDIKATOR.map(d => (
            <Isian key={d.key} judul={d.judul} nilai={ind[d.key]} disabled={d.key === 'jam_kunjungan' && !pertama}
              petunjuk={d.key === 'jam_kunjungan' && !pertama ? `${d.petunjuk}\n\nOtomatis N/A karena bukan toko pertama yang dikunjungi hari itu.` : d.petunjuk}
              onUbah={v => setInd(s => ({ ...s, [d.key]: v }))} />))}
          <div><b className="tg-lbl">Temuan Lain saat di Toko</b><p className="tg-petunjuk">{TEMUAN_PETUNJUK}</p>
            <textarea className="tg-ta" aria-label="Temuan lain" rows={2} placeholder="Opsional" value={temuan} maxLength={1000} onChange={e => setTemuan(e.target.value)} /></div>
          <div><b className="tg-lbl">Hasil diskusi dengan Salesman atas ketidaksesuaian (DKS vs Hasil Back Track)</b>
            <textarea className="tg-ta" aria-label="Hasil diskusi" rows={2} placeholder="Opsional" value={diskusi} maxLength={1000} onChange={e => setDiskusi(e.target.value)} /></div>
          <p className="fhint">Konfirmasi hanya bisa disimpan saat Anda berada di outlet (maksimal {RADIUS_M} m). Lokasi dicek saat menekan Simpan.</p>
          {galat && <p className="err" role="alert">{galat}</p>}
          <div className="tg-aksi">
            <button type="button" onClick={kirim} disabled={simpan} aria-busy={simpan}>{simpan ? 'Mengecek lokasi dan menyimpan…' : 'Simpan konfirmasi'}</button>
            <button type="button" className="ghost" onClick={() => setBuka(false)} disabled={simpan}>Batal</button>
          </div>
        </div>)}
    </div>)
}
