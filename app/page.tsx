'use client'
import { useEffect, useState } from 'react'
import Shell from '../components/Shell'
import { supabase } from '../lib/supabase'
import { loadMe } from '../lib/auth'
import Icon from '../components/Icon'
import { rekap, day, rp, VSEL, fetchAll } from '../lib/rekap'

const cnt = async (t: string, role?: string) => {
  let q: any = supabase.from(t).select('id', { count: 'exact', head: true }); if (role) q = q.eq('role', role)
  return (await q).count ?? 0
}
function Home() {
  const [n, setN] = useState<any>({})
  const [role, setRole] = useState('')
  const [radius, setRadius] = useState<boolean | null>(null)
  const [rk, setRk] = useState<any>(null)
  useEffect(() => {
    (async () => setN({ Cabang: await cnt('cabang'), Outlet: await cnt('outlets'), Frontliner: await cnt('profiles', 'frontliner') }))()
    loadMe().then(({ me }) => setRole(me?.role || ''))
    supabase.from('settings').select('value').eq('key', 'radius_enforced').single().then(({ data }) => setRadius(data ? data.value === true : true))
    const m = `${day(new Date()).slice(0, 8)}01T00:00:00+07:00`
    fetchAll((a, b) => supabase.from('visits').select(VSEL).gte('checkin_at', m).order('checkin_at').range(a, b)).then(v => setRk(rekap(v))).catch(() => setRk({}))
  }, [])
  async function toggle(v: boolean) { const { error } = await supabase.from('settings').update({ value: v }).eq('key', 'radius_enforced'); if (!error) setRadius(v) }
  const days = rk ? Object.values(rk) as any[] : []
  const hari = rk?.[day(new Date())]
  const bulan = days.reduce((a, d) => a + d.value, 0), ocB = days.reduce((a, d) => a + d.oc, 0)
  const fokus: Record<string, { ec: number; qty: number }> = {}
  days.forEach(d => Object.entries(d.prod).forEach(([p, x]: any) => { if (x.focus) { const f = (fokus[p] ||= { ec: 0, qty: 0 }); f.ec += x.ec; f.qty += x.qty } }))
  const avg = days.length > 1 ? bulan / days.length : 0
  return (<>
    <h2>Home</h2>
    <div className="kpis">
      <div className="kpi"><span className="label">Penjualan hari ini</span><b>{rk ? rp(hari?.value || 0) : '…'}</b>
        {hari && avg > 0 && <small className="muted"><Icon name={hari.value >= avg ? 'up' : 'down'} size={14} /> {Math.abs(Math.round((hari.value / avg - 1) * 100))}% vs rata-rata harian</small>}</div>
      <div className="kpi"><span className="label">OC hari ini</span><b>{rk ? hari?.oc || 0 : '…'}</b></div>
      <div className="kpi"><span className="label">Penjualan bulan ini</span><b>{rk ? rp(bulan) : '…'}</b></div>
      <div className="kpi"><span className="label">OC bulan ini</span><b>{rk ? ocB : '…'}</b></div>
    </div>
    <div className="card"><span className="label">Produk fokus bulan ini</span>
      {Object.keys(fokus).length === 0 ? <p className="muted" style={{ margin: '8px 0 0' }}>Belum ada penjualan produk fokus. Tandai produk fokus di halaman Produk.</p>
        : Object.entries(fokus).map(([p, x]) => <div className="line" key={p}><span>{p}</span><b>EC {x.ec} · Qty {x.qty}</b></div>)}</div>
    <div className="row">{Object.entries(n).map(([k, v]) => <div className="kpi" key={k}><span className="label">{k}</span><b>{String(v)}</b></div>)}</div>
    <div className="card">
      <b>Wajib dekat outlet saat input penjualan</b>
      <p className="muted">{radius === null ? '…' : radius ? 'Aktif: check-in dan input penjualan hanya bisa maksimal 50 m dari outlet.' : 'Nonaktif: bisa input di mana saja.'}</p>
      {role === 'mdm' ? <label><input type="checkbox" checked={!!radius} onChange={e => toggle(e.target.checked)} /> Aktifkan aturan 50 meter</label>
        : <p className="muted" style={{ margin: 0 }}>Hanya MDM yang bisa mengubah pengaturan ini.</p>}
    </div>
  </>)
}
export default function Page() { return <Shell roles={['mds', 'mdm', 'rmdm', 'tl', 'kormot']}><Home /></Shell> }
