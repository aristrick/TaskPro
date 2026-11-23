'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Shell from '../../../components/Shell'
import PageHead from '../../../components/PageHead'
import Empty from '../../../components/Empty'
import Icon from '../../../components/Icon'
import { SkelRows } from '../../../components/Loaders'
import KonfirmasiPanel from '../../../components/tracking/KonfirmasiPanel'
import { supabase } from '../../../lib/supabase'
import { friendly } from '../../../lib/friendly'
import { n } from '../../../lib/angka'
import { unduhBuffer } from '../../../lib/excel'
import { day, jam, fetchAll, OFFSET, TZ, rp } from '../../../lib/rekap'
import { ambilPosisi, batasWaktu, formatDurasi, namaFile, susunRute, tglIndo, tglIndoDari, urlNavigasi, type KonfirmasiRow, type KunjunganRow, type Titik } from '../../../lib/trackinggo'
import { buatXlsxBacktrack, type BarisBacktrack, type InfoLaporan } from '../../../lib/trackinggo-excel'
import { belumMigrasi22, useTrackingData } from '../../../lib/use-tracking'

const SEL = 'id,outlet_id,checkin_at,checkout_at,cabang_id,cabang(tz),outlets(code,name,address,lat,long,created_at),sales(qty,price,value,products(product))'

function BackTracking() {
  const { me, cabs, fls, siap, galat: galatAwal } = useTrackingData()
  const hariIni = day(new Date()), kemarin = day(new Date(Date.now() - 864e5))
  const [cab, setCab] = useState(''), [fl, setFl] = useState('')
  const [tgl, setTgl] = useState(hariIni)   // satu tanggal saja
  const [visits, setVisits] = useState<KunjunganRow[]>([]), [konf, setKonf] = useState<KonfirmasiRow[]>([])
  const [muat, setMuat] = useState(false), [galat, setGalat] = useState(''), [migrasi, setMigrasi] = useState(false)
  const [pos, setPos] = useState<Titik | null>(null), [lokMuat, setLokMuat] = useState(false), [lokGalat, setLokGalat] = useState('')
  const [info, setInfo] = useState<InfoLaporan>({ namaPelaksana: '', tanggalPelaksanaan: tglIndo(hariIni), namaSalesman: '', tanggalDKS: '', tindaklanjut: '' })
  const [unduh, setUnduh] = useState(false)

  const pilihanFl = useMemo(() => fls.filter(f => !cab || f.cabang_id === cab), [fls, cab])
  const flObj = fls.find(f => f.id === fl)
  const tz = cabs.find(c => c.id === flObj?.cabang_id)?.tz || TZ
  const stops = useMemo(() => susunRute(visits, konf), [visits, konf])
  const belum = stops.findIndex(s => !s.konfirmasi)   // outlet pertama yang belum dikonfirmasi: formulirnya langsung terbuka

  useEffect(() => { if (cabs.length === 1) setCab(cabs[0].id) }, [cabs])
  useEffect(() => { if (fl && !pilihanFl.some(f => f.id === fl)) setFl('') }, [pilihanFl, fl])
  useEffect(() => { setInfo(i => ({ ...i, namaPelaksana: i.namaPelaksana || me?.nama || '' })) }, [me?.nama])
  useEffect(() => { setInfo(i => ({ ...i, namaSalesman: flObj?.nama || '', tanggalDKS: tglIndo(tgl) })) }, [flObj?.nama, tgl])

  const muatKonfirmasi = useCallback(async () => {
    if (!fl) return
    const { data, error } = await supabase.from('backtrack_konfirmasi').select('*').eq('frontliner_id', fl).eq('visit_date', tgl)
    if (error) { if (belumMigrasi22(error.message)) setMigrasi(true); else setGalat(friendly(error)); return }
    setKonf((data ?? []) as KonfirmasiRow[])
  }, [fl, tgl])

  useEffect(() => {
    setGalat('')
    if (!fl) { setVisits([]); setKonf([]); return }
    let batal = false
    setMuat(true)
    ;(async () => {
      try {
        const { a, b } = batasWaktu(tgl, tgl, OFFSET[tz] || '+07:00')
        const v = await fetchAll((x, y) => supabase.from('visits').select(SEL).eq('frontliner_id', fl).gte('checkin_at', a).lt('checkin_at', b).order('checkin_at').range(x, y))
        if (!batal) { setVisits(v as KunjunganRow[]); await muatKonfirmasi() }
      } catch (e) { if (!batal) setGalat(friendly(e, 'Gagal memuat data kunjungan.')) } finally { if (!batal) setMuat(false) }
    })()
    return () => { batal = true }
  }, [fl, tgl, tz, muatKonfirmasi])

  const perbaruiLokasi = useCallback(() => {
    setLokMuat(true); setLokGalat('')
    ambilPosisi().then(setPos).catch((e: Error) => setLokGalat(e.message)).finally(() => setLokMuat(false))
  }, [])
  useEffect(() => { if (fl && stops.length > 0 && !pos && !lokGalat) perbaruiLokasi() }, [fl, stops.length, pos, lokGalat, perbaruiLokasi])

  async function unduhFormat() {
    setUnduh(true)
    try {
      const kosong = { status: '' as const, keterangan: '' }
      const rows: BarisBacktrack[] = stops.map(s => ({ kodePelanggan: s.kode, namaPelanggan: s.nama, temuanLain: s.konfirmasi?.temuan_lain || '', hasilDiskusi: s.konfirmasi?.hasil_diskusi || '',
        jam_kunjungan: s.konfirmasi?.jam_kunjungan ?? kosong, on_rayon: s.konfirmasi?.on_rayon ?? kosong, kunjungan_manual: s.konfirmasi?.kunjungan_manual ?? kosong, pv_satu: s.konfirmasi?.pv_satu ?? kosong }))
      unduhBuffer(`BACK_TRACKING_${namaFile(info.namaSalesman || 'unknown')}_${namaFile(info.tanggalDKS)}.xlsx`, await buatXlsxBacktrack(info, rows))
    } catch (e) { setGalat(friendly(e, 'Gagal membuat file Back Tracking.')) } finally { setUnduh(false) }
  }
  const ubah = (k: keyof InfoLaporan) => (e: { target: { value: string } }) => setInfo(i => ({ ...i, [k]: e.target.value }))

  if (siap && cabs.length === 0) return <><PageHead title="Back Tracking" /><Empty icon="alert" title="Belum ada cabang untuk akun ini">{galatAwal || 'Minta MDM mengatur cabang akun Anda.'}</Empty></>
  return (<>
    <PageHead title="Back Tracking" desc="Pilih frontliner dan tanggal, lalu cek outlet satu per satu. Pertanyaan konfirmasi langsung muncul di outlet pertama yang belum dicek." />
    {migrasi && <Empty icon="alert" title="Database belum siap untuk Tracking Go">Jalankan <b>22_migration.sql</b> sekali di Supabase &gt; SQL Editor, lalu muat ulang halaman ini.</Empty>}
    <section className="tg-filter" aria-label="Pilih frontliner dan tanggal">
      {cabs.length > 1 && <label><span className="tg-lbl">Cabang</span><select value={cab} onChange={e => setCab(e.target.value)}><option value="">Semua cabang</option>{cabs.map(c => <option key={c.id} value={c.id}>{c.kode} · {c.nama}</option>)}</select></label>}
      <label><span className="tg-lbl">Frontliner</span><select value={fl} onChange={e => setFl(e.target.value)} disabled={!siap}><option value="">{siap ? 'Pilih frontliner' : 'Memuat…'}</option>{pilihanFl.map(f => <option key={f.id} value={f.id}>{f.user_id} · {f.nama}</option>)}</select></label>
      <div><span className="tg-lbl">Tanggal</span>
        <div className="tg-tgl">
          <input type="date" aria-label="Tanggal kunjungan" value={tgl} max={hariIni} onChange={e => e.target.value && setTgl(e.target.value)} />
          <button type="button" className="ghost" aria-pressed={tgl === hariIni} onClick={() => setTgl(hariIni)}>Hari ini</button>
          <button type="button" className="ghost" aria-pressed={tgl === kemarin} onClick={() => setTgl(kemarin)}>Kemarin</button>
        </div></div>
    </section>
    {galat && <div className="notice bad" role="alert">{galat}</div>}
    {!fl && siap && <Empty icon="users" title="Pilih frontliner dulu">Rute kunjungan dan ringkasan muncul setelah frontliner dipilih.</Empty>}
    {fl && muat && <SkelRows n={4} />}

    {fl && !muat && !galat && (stops.length === 0
      ? <Empty icon="calendar" title="Tidak ada kunjungan">Tidak ada kunjungan {flObj?.nama} pada {tglIndo(tgl)}.</Empty>
      : <>
        <div className="row">
          {lokMuat && <span className="muted">Mengambil lokasi Anda…</span>}
          {!lokMuat && pos && <span className="muted">Lokasi Anda terdeteksi. Jarak ke tiap outlet tampil di nama outlet.</span>}
          {!lokMuat && lokGalat && <span className="err">{lokGalat}</span>}
          <button type="button" className="ghost" onClick={perbaruiLokasi} disabled={lokMuat}><Icon name="locate" size={16} /> {pos ? 'Perbarui lokasi' : 'Aktifkan lokasi'}</button>
        </div>
        {stops.map((s, i) => (
          <article className="tg-stop" key={s.visitId}>
            <KonfirmasiPanel stop={s} indeks={i} nomor={i + 1} posisi={pos} onTersimpan={muatKonfirmasi} bukaOtomatis={i === belum}
              detail={<>
                <div className="tg-alamat">{s.alamat}</div>
                {s.lat != null && s.lng != null
                  ? <a className="tg-nav" href={urlNavigasi(s.lat, s.lng)} target="_blank" rel="noreferrer"><Icon name="nav" size={20} /> Navigasi ke outlet</a>
                  : <span className="tg-nav off">Lokasi outlet tidak ada</span>}
                <div className="tg-meta">
                  <span>Check-in <b>{jam(s.checkinAt, s.tz)}</b> · Check-out <b>{s.checkoutAt ? jam(s.checkoutAt, s.tz) : '-'}</b></span>
                  <span title={s.outletDibuat ? `${day(s.outletDibuat, s.tz)} ${jam(s.outletDibuat, s.tz)}` : undefined}>Outlet dibuat: <b>{s.outletDibuat ? tglIndoDari(s.outletDibuat, s.tz) : '-'}</b></span>
                  <span>Durasi kunjungan: <b>{formatDurasi(s.durasiDtk)}</b></span>
                  <span>Selisih dari outlet sebelumnya: {s.pertama ? <b>outlet pertama</b> : s.tumpangTindih ? <span className="tg-pill warn">tumpang tindih {formatDurasi(s.jedaDtk)}</span> : <b>{formatDurasi(s.jedaDtk)}</b>}</span>
                  {s.checkoutBedaHari && <span className="tg-pill warn" title="Check-out tercatat di tanggal berbeda dari check-in, kemungkinan lupa check-out">Check-out beda hari</span>}
                </div>
                {s.items.length > 0 && <ul className="tg-jual">{s.items.map((it, j) => <li key={j}>{it.produk} {n(it.qty)} pcs, Value {rp(it.value)}</li>)}<li><b>Total {rp(s.total)}</b></li></ul>}
              </>} />
          </article>))}
        <section className="card" aria-label="Info laporan">
          <h3>Info Report Back Tracking Sales</h3>
          <div className="tg-grid">
            <label><span className="tg-lbl">Nama Pelaksana</span><input style={{ width: '100%' }} value={info.namaPelaksana} onChange={ubah('namaPelaksana')} /></label>
            <label><span className="tg-lbl">Tanggal Pelaksanaan</span><input style={{ width: '100%' }} value={info.tanggalPelaksanaan} onChange={ubah('tanggalPelaksanaan')} /></label>
            <label><span className="tg-lbl">Nama Salesman</span><input style={{ width: '100%' }} value={info.namaSalesman} onChange={ubah('namaSalesman')} /></label>
            <label><span className="tg-lbl">Tanggal DKS</span><input style={{ width: '100%' }} value={info.tanggalDKS} onChange={ubah('tanggalDKS')} /></label>
          </div>
          <label style={{ display: 'block', marginTop: 12 }}><span className="tg-lbl">Tindak lanjut ketidaksesuaian (kesimpulan seluruh laporan)</span><textarea className="tg-ta" rows={2} placeholder="Opsional" value={info.tindaklanjut} onChange={ubah('tindaklanjut')} /></label>
          <div className="tg-aksi" style={{ marginTop: 12 }}><button type="button" onClick={unduhFormat} disabled={unduh} aria-busy={unduh}><Icon name="download" size={18} /> Unduh format Back Track (.xlsx)</button></div>
          <p className="fhint" style={{ marginTop: 8 }}>Outlet yang belum dikonfirmasi diekspor dengan kolom indikator kosong.</p>
        </section>
      </>)}

  </>)
}
export default function Page() { return <Shell roles={['mds', 'mdm', 'rmdm', 'tl', 'kormot']}><BackTracking /></Shell> }
