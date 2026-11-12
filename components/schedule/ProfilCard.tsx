'use client'
import Icon from '../Icon'
import { SettingRow } from '../Switch'
import { inisial } from '../mds/AkunCard'
import { labelHari, tanggalPanjang } from '../../lib/jadwal'

// Kartu frontliner yang sedang dibuka: ID/Nama, project aktif, check-in terakhir, kunci jadwal, dan keterangan siklus minggu.
export default function ProfilCard({ nama, userId, project, checkin, terkunci, bisaKunci, onKunci, posisi, awalSiklus, bisaAtur, onAtur, onIsi, bisaUbah }: {
  nama: string; userId: string; project?: string; checkin?: string; terkunci: boolean; bisaKunci: boolean; onKunci: (v: boolean) => void
  posisi: { minggu: number; hari: number } | null; awalSiklus: string | null; bisaAtur: boolean; onAtur: () => void; onIsi: () => void; bisaUbah: boolean }) {
  return (
    <section className="card sc-prof" aria-label={`Profil ${nama}`}>
      <div className="sc-pt">
        <span className="sc-avatar" aria-hidden="true">{inisial(nama)}</span>
        <dl className="sc-dl">
          <div><dt>ID / Nama</dt><dd><b>{userId}</b> · {nama}</dd></div>
          <div><dt>Project aktif</dt><dd>{project || <span className="muted">Belum masuk project</span>}</dd></div>
          <div><dt>Check-in terakhir</dt><dd>{checkin || <span className="muted">Belum pernah</span>}</dd></div>
        </dl>
      </div>
      <div className="sc-cycle">
        <Icon name="calendar" size={18} />
        <span>{posisi ? <>Hari ini: <b>{labelHari(posisi.minggu, posisi.hari)}</b>{posisi.hari > 6 && ' (tidak ada jadwal)'}</> : 'Posisi siklus belum terbaca'}
          {' · '}{awalSiklus ? <>Minggu ke 1 dimulai Senin {tanggalPanjang(awalSiklus)}</> : <span className="sc-warn">awal siklus belum diatur (memakai patokan bawaan)</span>}</span>
        {bisaAtur && <button type="button" className="ghost small" onClick={onAtur}>Atur awal siklus</button>}
      </div>
      <SettingRow icon="lock" title="Kunci jadwal" checked={terkunci} onChange={onKunci} canEdit={bisaKunci}
        desc={terkunci ? 'Menyala: frontliner tidak bisa memilih rayon. Layarnya mengikuti jadwal di bawah, dan check-in di luar rayon hari ini ditolak.'
          : 'Mati: frontliner bebas memilih rayon di HP-nya. Jadwal di bawah hanya menjadi petunjuk.'} noteNoEdit="Hanya MDM dan RMDM yang dapat mengunci jadwal" />
      {bisaUbah && <div className="sc-tools"><button type="button" className="ghost small" onClick={onIsi}><Icon name="list" size={16} /> Isi urut R01–R24</button>
        <small className="muted">Mengisi hari yang masih kosong: Minggu 1 Senin = R01 sampai Minggu 4 Sabtu = R24.</small></div>}
    </section>)
}
