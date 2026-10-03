'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { loadMe } from '../lib/auth'
import { useDialog } from './Dialog'
import { friendly } from '../lib/friendly'
import Icon from './Icon'

// Pindahkan semua outlet dari satu Kode MD ke Kode MD lain (opsional per rayon). Dipakai saat frontliner berhenti atau mutasi.
// Dibatasi di database: hanya satu cabang, hanya akun frontliner tujuan yang terdaftar, dan hanya cabang dalam wewenang pemanggil.
export default function PindahOutlet({ kmds, onDone }: { kmds: string[]; onDone: () => void }) {
  const dlg = useDialog()
  const [ok, setOk] = useState(false)
  const [fls, setFls] = useState<any[]>([])
  const [dari, setDari] = useState(''); const [ke, setKe] = useState(''); const [rayon, setRayon] = useState('')
  const [n, setN] = useState<number | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  useEffect(() => {
    loadMe().then(({ me }) => setOk(['mds', 'rmdm', 'mdm'].includes(me?.role)))
    supabase.from('profiles').select('id,user_id,nama').eq('role', 'frontliner').order('user_id').then(({ data }) => setFls(data || []))
  }, [])
  useEffect(() => {
    setN(null); setErr('')
    if (!dari || !ke || dari === ke) return
    supabase.rpc('outlet_pindah', { p_from: dari, p_to: ke, p_rayon: rayon ? +rayon : null, p_hitung: true }).then(({ data, error }) => error ? setErr(error.message) : setN(data as number))
  }, [dari, ke, rayon])
  async function pindah() {
    const rtxt = rayon ? ` (rayon R${rayon.padStart(2, '0')})` : ''
    if (!(await dlg.confirm({ title: 'Pindahkan outlet?', okText: 'Pindahkan', icon: 'store',
      message: <><b>{n} outlet</b> dari <b>{dari}</b> akan dipindahkan ke <b>{ke}</b>{rtxt}. Kode outlet tidak berubah dan riwayat kunjungan tetap utuh.</> }))) return
    setBusy(true)
    const { data, error } = await supabase.rpc('outlet_pindah', { p_from: dari, p_to: ke, p_rayon: rayon ? +rayon : null, p_hitung: false })
    setBusy(false)
    if (error) return setErr(friendly(error))
    await dlg.alert({ title: 'Outlet dipindahkan', tone: 'ok', message: `${data} outlet kini milik ${ke}.` })
    setDari(''); setKe(''); setRayon(''); setN(null); onDone()
  }
  if (!ok) return null
  return (
    <div className="card">
      <span className="label" style={{ marginBottom: 8 }}>Pindahkan outlet antar frontliner</span>
      <div className="row" style={{ margin: 0 }}>
        <label className="fld"><span className="label">Dari Kode MD</span>
          <select value={dari} onChange={e => setDari(e.target.value)}><option value="">Pilih…</option>{kmds.map(k => <option key={k} value={k}>{k}</option>)}</select></label>
        <label className="fld"><span className="label">Ke Kode MD</span>
          <select value={ke} onChange={e => setKe(e.target.value)}><option value="">Pilih…</option>{fls.filter(f => f.user_id !== dari).map(f => <option key={f.id} value={f.user_id}>{f.user_id} · {f.nama}</option>)}</select></label>
        <label className="fld"><span className="label">Rayon (opsional)</span>
          <select value={rayon} onChange={e => setRayon(e.target.value)}><option value="">Semua rayon</option>{Array.from({ length: 24 }, (_, i) => <option key={i} value={i + 1}>R{String(i + 1).padStart(2, '0')}</option>)}</select></label>
      </div>
      {err && <p className="err" role="alert" style={{ margin: '4px 0 8px' }}>{err}</p>}
      <div className="row" style={{ margin: 0 }}>
        <button disabled={busy || !n} aria-busy={busy} onClick={pindah}><Icon name="store" size={18} /> {n === null ? 'Pindahkan' : `Pindahkan ${n} outlet`}</button>
        {dari && ke && n === 0 && <span className="muted">Tidak ada outlet yang cocok.</span>}</div>
      <p className="muted" style={{ margin: '8px 0 0', fontSize: 13 }}>Tujuan harus akun frontliner di cabang yang sama. Sebelum menghapus akun frontliner, pindahkan dulu semua outletnya.</p>
    </div>)
}
