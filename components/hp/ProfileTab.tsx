import Icon from '../Icon'

// Tab Profile di HP frontliner: avatar, nama, User ID, menu stok pembawaan, dan LOG OUT.
export default function ProfileTab({ nama, userId, stokSum, onStok, onLogout }: { nama: string; userId: string; stokSum: { n: number; pcs: number; sisa: number }; onStok: () => void; onLogout: () => void }) {
  return (
    <div className="profile fade">
      <div className="avatar" aria-hidden="true"><svg viewBox="0 0 120 120"><circle cx="60" cy="46" r="20" /><path d="M20 108c2-24 18-36 40-36s38 12 40 36z" /></svg></div>
      <h2 className="pname">{nama}</h2>
      <p className="pid">{userId}</p>
      <button className="menurow" onClick={onStok}>
        <span className="mi"><Icon name="box" /></span>
        <span className="mt"><b>Tambahkan stok pembawaan</b><small>{stokSum.n ? `Hari ini: ${stokSum.n} produk · ${stokSum.pcs} pcs (sisa ${stokSum.sisa})` : 'Belum ada stok hari ini'}</small></span>
        <Icon name="chevron" size={18} /></button>
      <button className="logout" onClick={onLogout}>LOG OUT</button>
    </div>
  )
}
