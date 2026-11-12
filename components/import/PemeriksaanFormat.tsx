import Icon from '../Icon'
import type { Pemeriksaan } from '../../lib/dmp'

// Hasil pemeriksaan format file DMP sebelum diproses: sesuai (ringkas) atau tidak sesuai (daftar yang harus diperbaiki + tombol unduh format contoh).
export default function PemeriksaanFormat({ cek, namaFile, onUnduh }: { cek: Pemeriksaan; namaFile: string; onUnduh: () => void }) {
  if (cek.ok) return (
    <div className="notice ok" role="status">
      <b><Icon name="check" size={16} /> Format sesuai.</b> File <b>{namaFile}</b>, sheet “{cek.sheet}”, judul kolom di baris {cek.barisHeader}, {cek.jumlahBaris} baris data.
      {cek.tambahan.length > 0 && <div className="fhint">Kolom tambahan diabaikan: {cek.tambahan.join(', ')}.</div>}
      {cek.opsionalTidakAda.length > 0 && <div className="fhint">Kolom opsional tidak ada (dikosongkan): {cek.opsionalTidakAda.join(', ')}.</div>}
    </div>)
  return (
    <div className="notice bad" role="alert">
      <b><Icon name="alert" size={16} /> Format file belum sesuai, jadi file tidak diproses.</b>
      <ul>{cek.masalah.map((m, i) => <li key={i}>{m}</li>)}</ul>
      <div className="fhint">File <b>{namaFile}</b>{cek.sheet ? <>, sheet “{cek.sheet}”{cek.barisHeader ? `, judul kolom di baris ${cek.barisHeader}` : ''}</> : null}. Nama kolom harus persis seperti format contoh.</div>
      <button className="ghost small" style={{ marginTop: 10 }} onClick={onUnduh}><Icon name="download" size={16} /> Unduh format contoh</button>
    </div>)
}
