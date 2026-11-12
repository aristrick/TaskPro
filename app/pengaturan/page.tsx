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
function Pengaturan() {
  const dlg = useDialog()
  const [role, setRole] = useState('')
  const [radius, setRadius] = useState<boolean | null>(null)
  const [stok, setStok] = useState<boolean | null>(null)
  const [usage, setUsage] = useState<any>(null)
  const mdm = role === 'mdm'

  useEffect(() => {
    loadMe().then(({ me }) => setRole(me?.role || ''))
    supabase.from('settings').select('value').eq('key', 'radius_enforced').maybeSingle().then(({ data }) => setRadius(data ? data.value === true : true))
    supabase.from('settings').select('value').eq('key', 'stok_enforced').maybeSingle().then(({ data }) => setStok(data ? data.value === true : true))
  }, [])
  useEffect(() => { if (mdm) supabase.rpc('db_usage').then(({ data }) => setUsage(data)) }, [mdm])

  // Mematikan aturan memengaruhi semua frontliner, jadi dikonfirmasi dulu. Tampilan diperbarui langsung dan dikembalikan jika gagal.
  async function ubah(key: string, v: boolean, set: (x: boolean) => void, matikan: { title: string; message: ReactNode }) {
    if (!v && !(await dlg.confirm({ ...matikan, okText: 'Matikan', tone: 'danger' }))) return
    set(v)
    const { error } = await supabase.from('settings').update({ value: v }).eq('key', key)
    if (error) { set(!v); dlg.alert({ title: 'Gagal menyimpan', message: friendly(error), tone: 'danger', icon: 'close' }) }
  }

  const BATAS = Number(process.env.NEXT_PUBLIC_DB_LIMIT_MB || 500) * 1024 * 1024   // paket gratis Supabase: 500 MB (isi NEXT_PUBLIC_DB_LIMIT_MB jika paket naik)
  const pakai = usage ? Number(usage.bytes) / BATAS : 0

  return (<>
    <PageHead title="Aturan & Sistem" desc="Aturan yang berlaku untuk semua frontliner, dan kapasitas database." />
    <div className="group">
      <SettingRow icon="locate" title="Wajib dekat outlet saat input penjualan" checked={radius} canEdit={mdm}
        desc={radius ? 'Aktif: check-in dan input penjualan hanya bisa maksimal 50 m dari outlet.' : 'Nonaktif: bisa input di mana saja.'}
        onChange={v => ubah('radius_enforced', v, setRadius, { title: 'Matikan aturan 50 meter?', message: 'Semua frontliner bisa check-in dan input penjualan dari mana saja, kecuali yang GPS-nya sudah dikecualikan.' })} />
      <SettingRow icon="basket" title="Batasi penjualan sesuai stok pembawaan" checked={stok} canEdit={mdm}
        desc={stok ? 'Aktif: frontliner harus mengisi stok pembawaan harian, dan penjualan tidak bisa melebihi stok yang dibawa hari itu.' : 'Nonaktif: penjualan tidak dibatasi stok.'}
        onChange={v => ubah('stok_enforced', v, setStok, { title: 'Matikan batas stok?', message: 'Penjualan tidak lagi dibatasi stok pembawaan. Frontliner bisa menjual berapa pun.' })} />
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
