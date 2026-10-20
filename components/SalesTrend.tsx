import { rp, rpc, rpk, skala } from '../lib/rekap'

export type TitikHari = { k: string; v: number; today: boolean; l: string; tgl: string; lengkap: string }

// Grafik batang 7 hari: sumbu dan garis bantu, angka di atas tiap batang, hari ini disorot, plus ringkasan (total, rata-rata, hari terbaik).
export default function SalesTrend({ seri }: { seri: TitikHari[] }) {
  const total = seri.reduce((a, x) => a + x.v, 0), maks = Math.max(...seri.map(x => x.v))
  if (total === 0) return <p className="trend-empty">Belum ada penjualan dalam 7 hari terakhir. Grafik muncul setelah ada penjualan yang tersimpan.</p>
  const { top, ticks } = skala(maks), terbaik = seri.find(x => x.v === maks)!
  const pct = (v: number) => (v / top) * 100
  return (
    <div className="trend">
      <div className="trend-stats">
        <div><span className="label">Total 7 hari</span><b>{rpk(total)}</b></div>
        <div><span className="label">Rata-rata per hari</span><b>{rpk(total / seri.length)}</b></div>
        <div><span className="label">Hari terbaik</span><b>{terbaik.l} {terbaik.tgl}</b><small>{rpk(terbaik.v)}</small></div>
      </div>

      <div className="trend-chart" role="img" aria-label={`Penjualan 7 hari terakhir: ${seri.map(x => `${x.l} ${x.tgl} ${rpk(x.v)}`).join(', ')}`}>
        <div className="trend-y" aria-hidden="true">{ticks.map(t => <span key={t} style={{ bottom: `${pct(t)}%` }}>{t === 0 ? '0' : rpc(t)}</span>)}</div>
        <div className="trend-plot">
          <div className="trend-grid" aria-hidden="true">{ticks.map(t => <i key={t} className={t === 0 ? 'base' : undefined} style={{ bottom: `${pct(t)}%` }} />)}</div>
          <div className="trend-cols">
            {seri.map(x => <div key={x.k} className={['tcol', x.today && 'today', x.v === 0 && 'zero'].filter(Boolean).join(' ')} title={`${x.lengkap}: ${x.v ? rp(x.v) : 'belum ada penjualan'}`}>
              <span className="tval" style={{ bottom: `calc(${x.v ? pct(x.v) : 0}% + 6px)` }}>{x.v ? rpc(x.v) : '-'}</span>
              <i className="tbar" style={{ height: x.v ? `${Math.max(2, pct(x.v))}%` : undefined }} />
            </div>)}
          </div>
        </div>
        <div className="trend-x">{seri.map(x => <div key={x.k} className={x.today ? 'today' : undefined}><b>{x.l}</b><small>{x.today ? 'Hari ini' : <>{x.tgl.split(' ')[0]}<span className="bln"> {x.tgl.split(' ').slice(1).join(' ')}</span></>}</small></div>)}</div>
      </div>
      <p className="trend-note">Angka dalam rupiah (rb = ribu, jt = juta). Batang gelap = hari ini.</p>
    </div>)
}
