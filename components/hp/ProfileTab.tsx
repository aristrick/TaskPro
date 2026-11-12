import Icon from '../Icon'
import { rp } from '../../lib/rekap'

const inisial = (nama: string) => (nama || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase()

// Tab Profile di HP frontliner: inisial, nama, User ID, kartu "Hari ini", menu berkelompok, dan Log out (teks merah di dasar halaman).
export default function ProfileTab({ nama, userId, stokSum, rayonHariIni, kunjunganHariIni, penjualanHariIni, onStok, onLogout, onPrinter, onReprint, printerInfo, strukInfo }: {
  nama: string; userId: string; stokSum: { n: number; pcs: number; sisa: number }; rayonHariIni: string | null; kunjunganHariIni: number; penjualanHariIni: number | null
  onStok: () => void; onLogout: () => void; onPrinter: () => void; onReprint: () => void; printerInfo: string; strukInfo: string | null }) {
  return (
    <div className="profile fade">
      <div className="pheader">
        <div className="avatar-i lg" aria-hidden="true">{inisial(nama)}</div>
        <div className="pheader-t"><h2 className="pname">{nama}</h2><p className="pid">{userId}</p></div>
      </div>

      <section className="todaycard" aria-label="Ringkasan hari ini">
        <h3>Hari ini</h3>
        <div className="todaygrid">
          <div><small>Rayon jadwal</small><b>{rayonHariIni || 'Bebas'}</b></div>
          <div><small>Kunjungan</small><b>{kunjunganHariIni}</b></div>
          <div><small>Penjualan</small><b>{penjualanHariIni == null ? '…' : rp(penjualanHariIni)}</b></div>
        </div>
      </section>

      <div className="group">
        <button className="menurow" onClick={onStok}>
          <span className="mi"><Icon name="box" /></span>
          <span className="mt"><b>Tambahkan stok pembawaan</b><small>{stokSum.n ? `Hari ini: ${stokSum.n} produk · ${stokSum.pcs} pcs (sisa ${stokSum.sisa})` : 'Belum ada stok hari ini'}</small></span>
          <Icon name="chevron" size={18} /></button>
        <button className="menurow" onClick={onPrinter}>
          <span className="mi"><Icon name="printer" /></span>
          <span className="mt"><b>Printer dan struk</b><small>{printerInfo}</small></span>
          <Icon name="chevron" size={18} /></button>
        <button className="menurow" onClick={onReprint} disabled={!strukInfo}>
          <span className="mi"><Icon name="receipt" /></span>
          <span className="mt"><b>Cetak ulang struk terakhir</b><small>{strukInfo || 'Belum ada struk'}</small></span>
          <Icon name="chevron" size={18} /></button>
      </div>

      <button className="logout" onClick={onLogout}>Log out</button>
    </div>
  )
}
