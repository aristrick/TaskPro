import Icon from '../Icon'
import { SkelRows } from '../Loaders'
import { rp, day, OFFSET } from '../../lib/rekap'

// Tab Rekap di HP frontliner: daftar hari bulan ini, dan rincian satu hari (produk fokus EC, per produk, outlet).
// Data rk berasal dari rekap(); sel = tanggal terpilih ('' = daftar); sub = arah animasi.
export default function RekapTab({ rk, sel, sub, tz, onPick }: { rk: Record<string, any> | null; sel: string; sub: string; tz: string; onPick: (d: string) => void }) {
  const days = rk ? Object.keys(rk).sort().reverse() : []
  const dd = sel && rk ? rk[sel] : null
  const tgl = (d: string, o: Intl.DateTimeFormatOptions) => new Date(d + 'T00:00:00' + (OFFSET[tz] || '+07:00')).toLocaleDateString('id-ID', { ...o, timeZone: tz })
  const bulanDays = rk ? days.filter(x => x.startsWith(day(new Date(), tz).slice(0, 7))) : []
  const bulanVal = bulanDays.reduce((a, x) => a + (rk as any)[x].value, 0), bulanOc = bulanDays.reduce((a, x) => a + (rk as any)[x].oc, 0)
  const others = days.filter(x => x !== sel).map(x => (rk as any)[x].value).filter((v: number) => v > 0)
  const avg = others.length ? others.reduce((a: number, b: number) => a + b, 0) / others.length : 0
  return (
    <>
      {!rk ? <SkelRows n={5} /> : dd ? (() => {
        const prods = Object.entries(dd.prod).map(([n, p]: any) => ({ n, ...p })).sort((a: any, b: any) => b.value - a.value)
        const fokus = prods.filter((p: any) => p.focus), pcsHari = prods.reduce((a: number, p: any) => a + p.qty, 0)
        const pct = avg > 0 && dd.value > 0 ? Math.round((dd.value / avg - 1) * 100) : null
        return <div className={`rk ${sub}`}>
          <section className="rk-hero">
            <div className="rk-eyebrow">{tgl(sel, { weekday: 'long' })}</div>
            <div className="rk-date">{tgl(sel, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            <div className="rk-total num">{rp(dd.value)}</div>
            <div className="rk-sub">Total penjualan</div>
            {pct !== null && <div className={`rk-cmp ${pct >= 0 ? 'up' : 'down'}`}><Icon name={pct >= 0 ? 'up' : 'down'} size={16} />{Math.abs(pct)}% {pct >= 0 ? 'di atas' : 'di bawah'} rata-rata <span>({rp(avg)})</span></div>}
          </section>
          <div className="rk-stats">
            <div className="rk-stat"><b>{dd.oc}</b><span>OC</span></div>
            <div className="rk-stat"><b>{dd.visits}</b><span>Kunjungan</span></div>
            <div className="rk-stat"><b>{pcsHari}</b><span>Pcs</span></div></div>
          <section className="rk-card"><header><h4>Produk fokus</h4><small>EC = outlet yang membeli</small></header>
            {fokus.length === 0 ? <p className="rk-empty">Belum ada penjualan produk fokus.</p>
              : fokus.map((p: any) => <div className="rk-row" key={p.n}><div className="rk-name">{p.n}</div>
                <div className="rk-pills"><span className="rk-pill">EC {p.ec}</span><span className="rk-pill">{p.qty} pcs</span></div></div>)}</section>
          <section className="rk-card"><header><h4>Penjualan per produk</h4><small>{prods.length} produk</small></header>
            {prods.length === 0 ? <p className="rk-empty">Belum ada penjualan.</p>
              : prods.map((p: any) => <div className="rk-row" key={p.n}>
                <div><div className="rk-name">{p.n}</div><div className="rk-meta">{p.qty} pcs</div></div><div className="rk-val">{rp(p.value)}</div>
                <div className="rk-bar" aria-hidden="true"><i style={{ width: `${dd.value ? Math.max(3, (p.value / dd.value) * 100) : 0}%` }} /></div></div>)}</section>
          <section className="rk-card"><header><h4>Outlet bertransaksi</h4><small>{dd.outlets.length} outlet</small></header>
            {dd.outlets.length === 0 ? <p className="rk-empty">Belum ada outlet bertransaksi.</p>
              : dd.outlets.map((o: any, i: number) => <div className="rk-row rank" key={i}><span className="rk-rank">{i + 1}</span><div className="rk-name">{o.name}</div><div className="rk-val">{rp(o.value)}</div></div>)}</section>
        </div>
      })() : days.length === 0 ? <div className="empty"><b>Belum ada kunjungan</b><p className="muted">Rekap muncul setelah Anda check-out di outlet pertama.</p></div>
        : <div className={`rk ${sub}`}>
            <section className="rk-hero"><div className="rk-eyebrow">Bulan ini</div><div className="rk-total num">{rp(bulanVal)}</div>
              <div className="rk-sub">{bulanDays.length} hari kunjungan · {bulanOc} OC</div></section>
            <div className="rk-list">{days.map(x => <div className="rk-day" role="button" tabIndex={0} key={x} onClick={() => onPick(x)} onKeyDown={e => e.key === 'Enter' && onPick(x)}>
              <div className="rk-dt"><b>{tgl(x, { day: 'numeric' })}</b><span>{tgl(x, { month: 'short' })}</span></div>
              <div className="grow"><div className="rk-name">{tgl(x, { weekday: 'long' })}</div><div className="rk-meta">{rk[x].oc} OC · {rk[x].visits} kunjungan</div></div>
              <div className="rk-val">{rp(rk[x].value)}</div><Icon name="chevron" size={18} /></div>)}</div>
          </div>}
    </>
  )
}
