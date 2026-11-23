'use client'
import { useEffect, useState, type ReactNode } from 'react'
import Shell from '../../components/Shell'
import PageHead from '../../components/PageHead'
import { SettingRow } from '../../components/Switch'
import { useDialog } from '../../components/Dialog'
import { supabase } from '../../lib/supabase'
import { loadMe } from '../../lib/auth'
import { friendly } from '../../lib/friendly'

// Aturan operasional dan kapasitas database. Dipindahkan dari Home supaya dashboard hanya berisi angka kerja.
type Jam = { aktif: boolean; dari: string; sampai: string }
const ringkas = (j: Jam) => `${j.dari}–${j.sampai}`

function Pengaturan() {
  const dlg = useDialog()
  const [role, setRole] = useState('')
  const [radius, setRadius] = useState<boolean | null>(null)
  // Jam berlaku aturan radius. undefined = memuat, null = migrasi 21 belum dijalankan (bagian ini disembunyikan)
  const [jam, setJam] = useState<Jam | null | undefined>(undefined)
  const [draf, setDraf] = useState<Jam>({ aktif: false, dari: '08:00', sampai: '17:00' })
  const [simpanJam, setSimpanJam] = useState(false)
  const [stok, setStok] = useState<boolean | null>(null)
  const [cetak, setCetak] = useState<boolean | null>(null)   // saklar cetak struk frontliner (bawaan aktif)
  const [usage, setUsage] = useState<any>(null)
  const mdm = role === 'mdm'

  useEffect(() => {
    loadMe().then(({ me }) => setRole(me?.role || ''))
    supabase.from('settings').select('value').eq('key', 'radius_enforced').maybeSingle().then(({ data }) => setRadius(data ? data.value === true : true))
    supabase.from('settings').select('value').eq('key', 'radius_jam').maybeSingle().then(({ data }) => { const v = data?.value as Jam | undefined; setJam(v ?? null); if (v) setDraf(v) })
    supabase.from('settings').select('value').eq('key', 'stok_enforced').maybeSingle().then(({ data }) => setStok(data ? data.value === true : true))
    supabase.from('settings').select('value').eq('key', 'cetak_aktif').maybeSingle().then(({ data }) => setCetak(data ? data.value !== false : true))
  }, [])
  useEffect(() => { if (mdm) supabase.rpc('db_usage').then(({ data }) => setUsage(data)) }, [mdm])

  // Mematikan aturan memengaruhi semua frontliner, jadi dikonfirmasi dulu. Tampilan diperbarui langsung dan dikembalikan jika gagal.
  async function ubah(key: string, v: boolean, set: (x: boolean) => void, matikan: { title: string; message: ReactNode }, perluBaris = false) {
    if (!v && !(await dlg.confirm({ ...matikan, okText: 'Matikan', tone: 'danger' }))) return
    set(v)
    const { data, error } = await supabase.from('settings').update({ value: v }).eq('key', key).select('key')
    if (error || (perluBaris && !data?.length)) { set(!v); dlg.alert({ title: 'Gagal menyimpan', message: error ? friendly(error) : 'Pengaturan ini belum ada di database. Jalankan 23_migration.sql di Supabase SQL Editor, lalu coba lagi.', tone: 'danger', icon: 'close' }) }
  }

  // Menyimpan jam berlaku. Tampilan diperbarui lebih dulu, dikembalikan jika gagal.
  async function simpanJamBerlaku(baru: Jam) {
    const lama = jam
    setSimpanJam(true); setJam(baru); setDraf(baru)
    const { error } = await supabase.from('settings').update({ value: baru }).eq('key', 'radius_jam')
    setSimpanJam(false)
    if (error) { setJam(lama); if (lama) setDraf(lama); dlg.alert({ title: 'Gagal menyimpan', message: friendly(error), tone: 'danger', icon: 'close' }) }
  }
  const drafSama = !!jam && draf.dari === jam.dari && draf.sampai === jam.sampai
  const drafSalah = draf.dari === draf.sampai

  const BATAS = Number(process.env.NEXT_PUBLIC_DB_LIMIT_MB || 500) * 1024 * 1024   // paket gratis Supabase: 500 MB (isi NEXT_PUBLIC_DB_LIMIT_MB jika paket naik)
  const pakai = usage ? Number(usage.bytes) / BATAS : 0

  return (<>
    <PageHead title="Aturan & Sistem" desc="Aturan yang berlaku untuk semua frontliner, dan kapasitas database." />
    <div className="group">
      <SettingRow icon="locate" title="Wajib dekat outlet saat input penjualan" checked={radius} canEdit={mdm}
        desc={radius ? `Aktif: check-in dan input penjualan hanya bisa maksimal 50 m dari outlet${jam?.aktif ? `, pada jam ${ringkas(jam)}` : ''}.` : 'Nonaktif: bisa input di mana saja.'}
        onChange={v => ubah('radius_enforced', v, setRadius, { title: 'Matikan aturan 50 meter?', message: 'Semua frontliner bisa check-in dan input penjualan dari mana saja, kecuali yang GPS-nya sudah dikecualikan.' })} />
      {radius && jam && <div className="jamrow">
        <div className="jamhead">
          <div><b>Jam berlaku</b><p>{jam.aktif ? `Hanya jam ${ringkas(jam)} waktu cabang. Di luar jam itu, input bisa dari mana saja.` : 'Sepanjang hari, tanpa batas jam.'}</p></div>
          {mdm && <div className="seg" role="group" aria-label="Jam berlaku">
            <button type="button" className={!jam.aktif ? 'on' : ''} disabled={simpanJam} onClick={() => jam.aktif && simpanJamBerlaku({ ...jam, aktif: false })}>Sepanjang hari</button>
            <button type="button" className={jam.aktif ? 'on' : ''} disabled={simpanJam} onClick={() => !jam.aktif && simpanJamBerlaku({ ...draf, aktif: true })}>Atur jam</button></div>}
        </div>
        {mdm && jam.aktif && <div className="jamfields">
          <label className="fld"><span className="label">Dari jam</span><input type="time" value={draf.dari} onChange={e => setDraf({ ...draf, dari: e.target.value })} /></label>
          <label className="fld"><span className="label">Sampai jam</span><input type="time" value={draf.sampai} onChange={e => setDraf({ ...draf, sampai: e.target.value })} /></label>
          <button type="button" disabled={simpanJam || drafSama || drafSalah || !draf.dari || !draf.sampai} aria-busy={simpanJam} onClick={() => simpanJamBerlaku({ ...draf, aktif: true })}>{simpanJam ? 'Menyimpan…' : 'Simpan jam'}</button>
        </div>}
        {mdm && jam.aktif && <p className="jamnote">{drafSalah ? 'Jam mulai dan selesai tidak boleh sama.' : 'Mengikuti zona waktu cabang tiap frontliner (WIB/WITA/WIT). Rentang boleh melewati tengah malam, mis. 20:00–04:00.'}</p>}
      </div>}
      <SettingRow icon="basket" title="Batasi penjualan sesuai stok pembawaan" checked={stok} canEdit={mdm}
        desc={stok ? 'Aktif: frontliner harus mengisi stok pembawaan harian, dan penjualan tidak bisa melebihi stok yang dibawa hari itu.' : 'Nonaktif: penjualan tidak dibatasi stok.'}
        onChange={v => ubah('stok_enforced', v, setStok, { title: 'Matikan batas stok?', message: 'Penjualan tidak lagi dibatasi stok pembawaan. Frontliner bisa menjual berapa pun.' })} />
      <SettingRow icon="printer" title="Cetak struk penjualan frontliner" checked={cetak} canEdit={mdm}
        desc={cetak ? 'Aktif: frontliner bisa mencetak struk setelah check-out dan mengatur printer di menu Profile.' : 'Nonaktif: semua fitur cetak di HP frontliner dimatikan (tawaran cetak setelah check-out, Printer dan struk, cetak ulang struk terakhir).'}
        onChange={v => ubah('cetak_aktif', v, setCetak, { title: 'Matikan fitur cetak?', message: 'Semua frontliner tidak bisa lagi mencetak struk penjualan, dan menu printer di Profile disembunyikan. Penjualan dan check-out tetap berjalan seperti biasa.' }, true)} />
    </div>

    {mdm && <section className="card">
      <div className="sech-in"><h3>Penyimpanan database</h3>{usage && <span className="muted">{(pakai * 100).toFixed(0)}%</span>}</div>
      {!usage ? <div className="skel" style={{ height: 60 }} /> : <>
        <p className="muted" style={{ margin: '0 0 8px' }}>{(Number(usage.bytes) / 1048576).toFixed(1)} MB dari {(BATAS / 1048576).toFixed(0)} MB</p>
        <div className="meter" role="progressbar" aria-valuenow={Math.round(pakai * 100)} aria-valuemin={0} aria-valuemax={100}><i className={pakai >= .9 ? 'bad' : pakai >= .7 ? 'warn' : ''} style={{ width: `${Math.min(100, pakai * 100)}%` }} /></div>
        {pakai >= .7 && <p className={pakai >= .9 ? 'err' : 'muted'} style={{ margin: '8px 0 0' }}>{pakai >= .9 ? 'Hampir penuh: database bisa menjadi hanya-baca. ' : 'Mulai terisi. '}Ekspor lalu hapus data lama, atau naikkan paket Supabase.</p>}
        <div style={{ marginTop: 10 }}>{(usage.tabel || []).slice(0, 5).map((t: any) => <div className="line" key={t.nama}><span>{t.nama}</span><b>{(Number(t.bytes) / 1048576).toFixed(1)} MB</b></div>)}</div></>}
    </section>}
  </>)
}
export default function Page() { return <Shell roles={['mds', 'mdm', 'rmdm', 'tl', 'kormot']}><Pengaturan /></Shell> }
