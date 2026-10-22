import Icon from '../Icon'

export type Jauh = { name: string; d: number; lat: number | null | undefined; long: number | null | undefined }

// Pemberitahuan "terlalu jauh dari outlet" dengan tautan navigasi ke outlet.
export default function FarDialog({ far, onClose }: { far: Jauh | null; onClose: () => void }) {
  if (!far) return null
  return <div className="overlay" onClick={onClose}><div className="dialog" role="alertdialog" onClick={e => e.stopPropagation()}>
    <div className="dicon"><Icon name="pin" size={28} /></div>
    <h3>Terlalu jauh dari outlet</h3>
    <p>Jarak Anda <b>{far.d >= 1000 ? (far.d / 1000).toFixed(1) + ' km' : far.d + ' m'}</b> dari <b>{far.name}</b>. Check-in dan input penjualan hanya bisa maksimal 50 m dari outlet.</p>
    <div className="dbtns"><button className="ghost" onClick={onClose}>Cancel</button>
      {far.lat != null && <a className="btnlink" target="_blank" onClick={onClose} href={`https://www.google.com/maps/dir/?api=1&destination=${far.lat},${far.long}`}><Icon name="nav" size={18} /> Menuju Outlet</a>}</div></div></div>
}
