'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Shell from '../../../components/Shell'
import PageHead from '../../../components/PageHead'
import Empty from '../../../components/Empty'
import Icon from '../../../components/Icon'
import { SkelRows } from '../../../components/Loaders'
import PintasanTanggal from '../../../components/ui/Pintasan'
import KonfirmasiPanel from '../../../components/tracking/KonfirmasiPanel'
import { supabase } from '../../../lib/supabase'
import { friendly } from '../../../lib/friendly'
import { n } from '../../../lib/angka'
import { unduhBuffer } from '../../../lib/excel'
import { day, jam, fetchAll, OFFSET, TZ, rp } from '../../../lib/rekap'
import { ambilPosisi, batasWaktu, formatDurasi, hariAntara, namaFile, ringkasOutlet, susunRute, tglIndo, tglIndoDari, urlMaps, type KonfirmasiRow, type KunjunganRow, type Titik } from '../../../lib/trackinggo'
import { buatXlsxBacktrack, type BarisBacktrack, type InfoLaporan } from '../../../lib/trackinggo-excel'
import { belumMigrasi22, useTrackingData } from '../../../lib/use-tracking'

const SEL = 'id,outlet_id,checkin_at,checkout_at,cabang_id,cabang(tz),outlets(code,name,address,lat,long,created_at),sales(qty,price,value,products(product))'
const MAKS_HARI = 92

function BackTracking() {
  const { me, cabs, fls, siap, galat: galatAwal } = useTrackingData()
  const hariIni = day(new Date())
  const [cab, setCab] = useState(''), [fl, setFl] = useState('')
  const [dari, setDari] = useState(hariIni), [sampai, setSampai] = useState(hariIni)
  const [visits, setVisits] = useState<KunjunganRow[]>([]), [konf, setKonf] = useState<KonfirmasiRow[]>([])
  const [muat, setMuat] = useState(false), [galat, setGalat] = useState(''), [migrasi, setMigrasi] = useState(false)
  const [pos, setPos] = useState<Titik | null>(null), [lokMuat, setLokMuat] = useState(false), [lokGalat, setLokGalat] = useState('')
  const [info, setInfo] = useState<InfoLaporan>({ namaPelaksana: '', tanggalPelaksanaan: tglIndo(hariIni), namaSalesman: '', tanggalDKS: '', tindaklanjut: '' })
  const [unduh, setUnduh] = useState(false)

  const pilihanFl = useMemo(() => fls.filter(f => !cab || f.cabang_id === cab), [fls, cab])
  const flObj = fls.find(f => f.id === fl)
  const tz = cabs.find(c => c.id === flObj?.cabang_id)?.tz || TZ
  const rute = dari === sampai
  const stops = useMemo(() => (rute ? susunRute(visits, konf) : []), [rute, visits, konf])
  const ringkas = useMemo(() => (rute ? [] : ringkasOutlet(visits)), [rute, visits])

  useEffect(() => { if (cabs.length === 1) setCab(cabs[0].id) }, [cabs])
  useEffect(() => { if (fl && !pilihanFl.some(f => f.id === fl)) setFl('') }, [pilihanFl, fl])
  useEffect(() => { setInfo(i => ({ ...i, namaPelaksana: i.namaPelaksana || me?.nama || '' })) }, [me?.nama])
  useEffect(() => { setInfo(i => ({ ...i, namaSalesman: flObj?.nama || '', tanggalDKS: tglIndo(dari) })) }, [flObj?.nama, dari])

  const muatKonfirmasi = useCallback(async () => {
    if (!fl) return
    const { data, error } = await supabase.from('backtrack_konfirmasi').select('*').eq('frontliner_id', fl).gte('visit_date', dari).lte('visit_date', sampai)
    if (error) { if (belumMigrasi22(error.message)) setMigrasi(true); else setGalat(friendly(error)); return }
    setKonf((data ?? []) as KonfirmasiRow[])
  }, [fl, dari, sampai])

  useEffect(() => {
    setGalat('')
    if (!fl) { setVisits([]); setKonf([]); return }
    if (dari > sampai) return setGalat('Tanggal "Dari" tidak boleh setelah "Sampai".')
    if (hariAntara(dari, sampai) > MAKS_HARI) return setGalat(`Rentang tanggal maksimal ${MAKS_HARI} hari.`)
    let batal = false
    setMuat(true)
    ;(async () => {
      try {
        const { a, b } = batasWaktu(dari, sampai, OFFSET[tz] || '+07:00')
        const v = await fetchAll((x, y) => supabase.from('visits').select(SEL).eq('frontliner_id', fl).gte('checkin_at', a).lt('checkin_at', b).order('checkin_at').range(x, y))
        if (!batal) { setVisits(v as KunjunganRow[]); await muatKonfirmasi() }
      } catch (e) { if (!batal) setGalat(friendly(e, 'Gagal memuat data kunjungan.')) } finally { if (!batal) setMuat(false) }
    })()
    return () => { batal = true }
  }, [fl, dari, sampai, tz, muatKonfirmasi])

  const perbaruiLokasi = useCallback(() => {
    setLokMuat(true); setLokGalat('')
    ambilPosisi().then(setPos).catch((e: Error) => setLokGalat(e.message)).finally(() => setLokMuat(false))
  }, [])
  useEffect(() => { if (rute && fl && stops.length > 0 && !pos && !lokGalat) perbaruiLokasi() }, [rute, fl, stops.length, pos, lokGalat, perbaruiLokasi])

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
    <PageHead title="Back Tracking" desc="Pilih frontliner dan tanggal untuk melihat rute kunjungannya, lalu ketuk nama outlet untuk mengonfirmasi. Pilih beberapa hari untuk ringkasan per outlet. Data kunjungan dan penjualan diambil langsung dari TaskPro." />
    {migrasi && <Empty icon="alert" title="Database belum siap untuk Tracking Go">Jalankan <b>22_migration.sql</b> sekali di Supabase &gt; SQL Editor, lalu muat ulang halaman ini.</Empty>}
    <div className="row">
      {cabs.length > 1 && <select aria-label="Cabang" value={cab} onChange={e => setCab(e.target.value)}><option value="">Semua cabang</option>{cabs.map(c => <option key={c.id} value={c.id}>{c.kode} · {c.nama}</option>)}</select>}
      <select aria-label="Frontliner" value={fl} onChange={e => setFl(e.target.value)} disabled={!siap}><option value="">{siap ? 'Pilih frontliner' : 'Memuat…'}</option>{pilihanFl.map(f => <option key={f.id} value={f.id}>{f.user_id} · {f.nama}</option>)}</select>
      <input type="date" aria-label="Dari tanggal" value={dari} max={sampai} onChange={e => setDari(e.target.value)} />
      <input type="date" aria-label="Sampai tanggal" value={sampai} min={dari} onChange={e => setSampai(e.target.value)} />
      <PintasanTanggal dari={dari} sampai={sampai} onPilih={(a, b) => { setDari(a); setSampai(b) }} />
    </div>
    {galat && <div className="notice bad" role="alert">{galat}</div>}
    {!fl && siap && <Empty icon="users" title="Pilih frontliner dulu">Rute kunjungan dan ringkasan muncul setelah frontliner dipilih.</Empty>}
    {fl && muat && <SkelRows n={4} />}

    {fl && !muat && !galat && rute && (stops.length === 0
      ? <Empty icon="calendar" title="Tidak ada kunjungan">Tidak ada kunjungan {flObj?.nama} pada {tglIndo(dari)}.</Empty>
      : <>
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
        <div className="row">
          {lokMuat && <span className="muted">Mengambil lokasi Anda…</span>}
          {!lokMuat && pos && <span className="muted">Lokasi Anda terdeteksi. Jarak ke tiap outlet tampil di nama outlet.</span>}
          {!lokMuat && lokGalat && <span className="err">{lokGalat}</span>}
          <button type="button" className="ghost" onClick={perbaruiLokasi} disabled={lokMuat}><Icon name="locate" size={16} /> {pos ? 'Perbarui lokasi' : 'Aktifkan lokasi'}</button>
        </div>
        {stops.map((s, i) => (
          <article className="tg-stop" key={s.visitId}>
            <div className="tg-no" aria-hidden="true">{i + 1}</div>
            <div className="tg-isi">
              <KonfirmasiPanel stop={s} indeks={i} posisi={pos} onTersimpan={muatKonfirmasi} />
              <div className="muted" style={{ marginTop: 6 }}>{s.alamat}</div>
              <div className="tg-meta">
                <span>Check-in <b>{jam(s.checkinAt, s.tz)}</b> · Check-out <b>{s.checkoutAt ? jam(s.checkoutAt, s.tz) : '-'}</b></span>
                <span title={s.outletDibuat ? `${day(s.outletDibuat, s.tz)} ${jam(s.outletDibuat, s.tz)}` : undefined}>Outlet dibuat: <b>{s.outletDibuat ? tglIndoDari(s.outletDibuat, s.tz) : '-'}</b></span>
                <span>Durasi kunjungan: <b>{formatDurasi(s.durasiDtk)}</b></span>
                <span>Selisih dari outlet sebelumnya: {s.pertama ? <b>outlet pertama</b> : s.tumpangTindih ? <span className="tg-pill warn">tumpang tindih {formatDurasi(s.jedaDtk)}</span> : <b>{formatDurasi(s.jedaDtk)}</b>}</span>
                {s.checkoutBedaHari && <span className="tg-pill warn" title="Check-out tercatat di tanggal berbeda dari check-in, kemungkinan lupa check-out">Check-out beda hari</span>}
              </div>
              {s.items.length > 0 && <ul className="tg-jual">{s.items.map((it, j) => <li key={j}>{it.produk} {n(it.qty)} pcs, Value {rp(it.value)}</li>)}<li><b>Total {rp(s.total)}</b></li></ul>}
            </div>
            {s.lat != null && s.lng != null ? <a className="chip" href={urlMaps(s.lat, s.lng)} target="_blank" rel="noreferrer">Buka Maps</a> : <span className="muted">Lokasi tidak ada</span>}
          </article>))}
      </>)}

    {fl && !muat && !galat && !rute && (ringkas.length === 0
      ? <Empty icon="calendar" title="Belum ada kunjungan">Tidak ada kunjungan {flObj?.nama} pada {tglIndo(dari)} sampai {tglIndo(sampai)}.</Empty>
      : <div className="scroll"><table className="tg-tabel"><thead><tr><th>Outlet</th><th>Alamat</th><th>Outlet dibuat</th><th>Kunjungan</th><th>Total penjualan</th><th>Lokasi</th></tr></thead>
        <tbody>{ringkas.map(r => <tr key={r.outletId}>
          <td><b>{r.nama}</b><div className="muted" style={{ fontSize: 12 }}>{r.kode}</div></td><td>{r.alamat}</td>
          <td>{r.outletDibuat ? tglIndoDari(r.outletDibuat, r.tz) : '-'}</td><td>{n(r.kunjungan)}</td><td>{rp(r.total)}</td>
          <td>{r.lat != null && r.lng != null ? <a className="chip" href={urlMaps(r.lat, r.lng)} target="_blank" rel="noreferrer">Buka Maps</a> : '-'}</td></tr>)}</tbody></table></div>)}
  </>)
}
export default function Page() { return <Shell roles={['mds', 'mdm', 'rmdm', 'tl', 'kormot']}><BackTracking /></Shell> }
