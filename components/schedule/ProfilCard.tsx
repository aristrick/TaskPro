'use client'
import Icon from '../Icon'
import { Switch } from '../Switch'
import { inisial } from '../mds/AkunCard'
import { labelHari, tanggalPanjang } from '../../lib/jadwal'

// Kepala halaman frontliner: siapa (nama, ID, project), kapan terakhir check-in, status kunci jadwal, lalu satu baris siklus dengan aksi.
// Dibuat ringkas agar jadwalnya langsung terlihat tanpa menggulir.
export default function ProfilCard({ nama, userId, project, checkin, terkunci, bisaKunci, onKunci, posisi, awalSiklus, bisaAtur, onAtur, onIsi, bisaUbah }: {
  nama: string; userId: string; project?: string; checkin?: string; terkunci: boolean; bisaKunci: boolean; onKunci: (v: boolean) => void
  posisi: { minggu: number; hari: number } | null; awalSiklus: string | null; bisaAtur: boolean; onAtur: () => void; onIsi: () => void; bisaUbah: boolean }) {
  return (
    <section className="sc-prof" aria-label={`Profil ${nama}`}>
      <div className="sc-prof-main">
        <span className="sc-avatar" aria-hidden="true">{inisial(nama)}</span>
        <div className="sc-who">
          <h3>{nama}</h3>
          <p><b>{userId}</b>{' · '}{project || <span className="muted">Belum masuk project</span>}</p>
          <p className="sc-last">Check-in terakhir: {checkin || 'belum pernah'}</p>
        </div>
        <div className={`sc-lockbox ${terkunci ? 'on' : ''}`}>
          <span className="sc-lockic" aria-hidden="true"><Icon name="lock" size={18} /></span>
          <div className="sc-locktx"><b>Kunci jadwal</b>
            <small>{terkunci ? 'Terkunci: frontliner mengikuti jadwal' : 'Terbuka: frontliner bebas memilih rayon'}</small></div>
          {bisaKunci ? <Switch checked={terkunci} onChange={onKunci} label="Kunci jadwal" /> : <span className={terkunci ? 'on-badge' : 'off-badge'}>{terkunci ? 'Aktif' : 'Nonaktif'}</span>}
          {!bisaKunci && <small className="sc-locknote"><Icon name="lock" size={13} /> Hanya MDM dan RMDM yang dapat mengunci jadwal</small>}
        </div>
      </div>
      <div className="sc-cycle">
        <span className="sc-cycle-tx"><Icon name="calendar" size={16} />
          {posisi ? <span>Hari ini <b>{labelHari(posisi.minggu, posisi.hari)}</b>{posisi.hari > 6 && ' (tanpa jadwal)'}</span> : <span>Posisi siklus belum terbaca</span>}
          <span className="sc-dotsep" aria-hidden="true">•</span>
          {awalSiklus ? <span>Minggu ke 1 mulai Senin {tanggalPanjang(awalSiklus)}</span> : <span className="sc-warn">Awal siklus belum diatur</span>}</span>
        <span className="sc-cycle-act">
          {bisaAtur && <button type="button" className="ghost small" onClick={onAtur}>Atur awal siklus</button>}
          {bisaUbah && <button type="button" className="ghost small" onClick={onIsi} title="Mengisi hari yang masih kosong: Minggu 1 Senin = R01 sampai Minggu 4 Sabtu = R24"><Icon name="list" size={16} /> Isi urut R01–R24</button>}
        </span>
      </div>
    </section>)
}
