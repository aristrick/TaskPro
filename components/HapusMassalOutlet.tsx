'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { loadMe } from '../lib/auth'
import { useDialog } from './Dialog'
import { friendly } from '../lib/friendly'
import Icon from './Icon'

type Dampak = { outlet: number; dengan_riwayat: number; kunjungan: number; penjualan: number; berjalan: number }

// Hapus paksa semua outlet satu frontliner (opsional satu rayon). Hanya MDM. Dikunci dengan mengetik Kode MD, dan outlet yang dihapus diarsipkan 90 hari.
export default function HapusMassalOutlet({ kmds, onDone }: { kmds: string[]; onDone: () => void }) {
  const dlg = useDialog()
  const [ok, setOk] = useState(false)
  const [kode, setKode] = useState(''); const [rayon, setRayon] = useState(''); const [riwayat, setRiwayat] = useState(false)
  const [d, setD] = useState<Dampak | null>(null); const [ketik, setKetik] = useState('')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  useEffect(() => { loadMe().then(({ me }) => setOk(me?.role === 'mdm')) }, [])
  useEffect(() => {
    setD(null); setErr(''); setKetik('')
    if (!kode) return
    supabase.rpc('outlet_hapus_massal', { p_kode_md: kode, p_rayon: rayon ? +rayon : null, p_riwayat: false, p_hitung: true }).then(({ data, error }) => error ? setErr(friendly(error)) : setD(data as Dampak))
  }, [kode, rayon])
  const akan = d ? (riwayat ? d.outlet : d.outlet - d.dengan_riwayat) : 0
  const siap = !!d && akan > 0 && d.berjalan === 0 && ketik.trim().toUpperCase() === kode.toUpperCase()

  async function hapus() {
    if (!d) return
    const lingkup = rayon ? `rayon R${rayon.padStart(2, '0')}` : 'semua rayon'
    if (!(await dlg.confirm({ title: 'Hapus paksa outlet?', tone: 'danger', okText: 'Hapus', icon: 'trash',
      message: <><b>{akan} outlet</b> milik <b>{kode}</b> ({lingkup}) akan dihapus.{riwayat && d.kunjungan > 0 ? <> <b>{d.kunjungan} kunjungan dan {d.penjualan} baris penjualan ikut terhapus permanen.</b></> : null} Tindakan ini tidak bisa dibatalkan dari aplikasi.</> }))) return
    setBusy(true)
    const { data, error } = await supabase.rpc('outlet_hapus_massal', { p_kode_md: kode, p_rayon: rayon ? +rayon : null, p_riwayat: riwayat, p_hitung: false })
    setBusy(false)
    if (error) return setErr(friendly(error))
    const r = data as { outlet_dihapus: number; kunjungan_dihapus: number; dilewati: number }
    await dlg.alert({ title: 'Outlet dihapus', tone: 'ok', message: `${r.outlet_dihapus} outlet dihapus${r.kunjungan_dihapus ? `, ${r.kunjungan_dihapus} kunjungan ikut dihapus` : ''}${r.dilewati ? `. ${r.dilewati} outlet dilewati karena punya riwayat kunjungan` : ''}.` })
    setKode(''); setRayon(''); setRiwayat(false); setKetik(''); setD(null); onDone()
  }
  if (!ok) return null
  return (
    <div className="card dangerzone">
      <div className="sech-in"><h3><Icon name="alert" size={18} /> Hapus paksa outlet frontliner</h3><span className="chip warnchip">Khusus MDM</span></div>
      <div className="row" style={{ margin: 0 }}>
        <label className="fld"><span className="label">Frontliner (Kode MD)</span>
          <select value={kode} onChange={e => setKode(e.target.value)}><option value="">Pilih…</option>{kmds.map(k => <option key={k} value={k}>{k}</option>)}</select></label>
        <label className="fld"><span className="label">Rayon (kosong = semua)</span>
          <select value={rayon} onChange={e => setRayon(e.target.value)}><option value="">Semua rayon</option>{Array.from({ length: 24 }, (_, i) => <option key={i} value={i + 1}>R{String(i + 1).padStart(2, '0')}</option>)}</select></label>
      </div>
      {err && <p className="err" role="alert" style={{ margin: '4px 0 8px' }}>{err}</p>}
      {d && <>
        <div className="impact">
          <div><b>{d.outlet}</b><span>outlet cocok</span></div>
          <div><b>{d.dengan_riwayat}</b><span>punya riwayat kunjungan</span></div>
          <div><b>{d.kunjungan}</b><span>kunjungan</span></div>
          <div><b>{d.penjualan}</b><span>baris penjualan</span></div>
        </div>
        {d.berjalan > 0 && <p className="err" role="alert">Ada {d.berjalan} kunjungan yang masih berjalan. Minta frontliner check-out dulu.</p>}
        <div className="seg" role="radiogroup" aria-label="Cara menghapus" style={{ marginBottom: 8 }}>
          <button role="radio" aria-checked={!riwayat} className={!riwayat ? 'on' : ''} onClick={() => setRiwayat(false)}>Hanya yang tanpa riwayat (aman)</button>
          <button role="radio" aria-checked={riwayat} className={riwayat ? 'on' : ''} onClick={() => setRiwayat(true)}>Termasuk riwayat (permanen)</button>
        </div>
        <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>{riwayat
          ? 'Semua outlet dihapus beserta kunjungan dan penjualannya. Laporan lama yang memuat outlet ini ikut berubah.'
          : `Outlet yang pernah dikunjungi dilewati (${d.dengan_riwayat} outlet), sehingga laporan lama tetap utuh.`}</p>
        <label className="fld"><span className="label">Ketik <b>{kode}</b> untuk mengonfirmasi</span><input value={ketik} onChange={e => setKetik(e.target.value)} autoCapitalize="characters" autoComplete="off" /></label>
        <div className="row" style={{ margin: 0 }}>
          <button className="btn-danger" disabled={!siap || busy} aria-busy={busy} onClick={hapus}><Icon name="trash" size={18} /> {akan > 0 ? `Hapus ${akan} outlet` : 'Tidak ada yang bisa dihapus'}</button>
        </div></>}
      <p className="muted" style={{ margin: '12px 0 0', fontSize: 13 }}>Sebelum menghapus, unduh dulu datanya lewat <b>Download Excel</b>. Outlet yang dihapus disimpan di arsip selama 90 hari dan tindakan ini tercatat di Jejak Audit.</p>
    </div>)
}
