import type { ReactNode } from 'react'

// Kepala halaman seragam untuk semua menu: judul, satu kalimat penjelasan, dan tombol aksi di kanan (turun ke bawah di layar sempit).
export default function PageHead({ title, desc, children }: { title: string; desc?: ReactNode; children?: ReactNode }) {
  return (
    <div className="pagehead">
      <div className="pagehead-t"><h2>{title}</h2>{desc && <p className="muted pgdesc">{desc}</p>}</div>
      {children && <div className="pagehead-a">{children}</div>}
    </div>)
}
