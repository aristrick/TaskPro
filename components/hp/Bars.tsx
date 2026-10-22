import Icon from '../Icon'

// Check-out yang menunggu dikirim (disimpan di HP karena sinyal hilang).
export function OutboxBar({ n, mengirim, onKirim }: { n: number; mengirim: boolean; onKirim: () => void }) {
  if (n === 0) return null
  return <div className="notice warn row outbox" role="status">
    <span className="grow"><b>{n} kunjungan menunggu dikirim.</b> Data aman di HP dan dikirim otomatis saat sinyal kembali.</span>
    <button className="ghost small" disabled={mengirim} aria-busy={mengirim} onClick={onKirim}>{mengirim ? 'Mengirim…' : 'Kirim sekarang'}</button></div>
}

// Aplikasi dibuka tanpa sinyal dan memakai salinan kunjungan terakhir yang tersimpan.
export function OfflineBar({ onMuat }: { onMuat: () => void }) {
  return <div className="notice warn row offlinebar" role="status">
    <span className="grow"><Icon name="alert" size={16} /> Mode offline: menampilkan kunjungan terakhir yang tersimpan. Check-out dikirim otomatis saat sinyal kembali.</span>
    <button className="ghost small" onClick={onMuat}>Coba terhubung lagi</button></div>
}
