import type { ReactNode } from 'react'
import Icon from './Icon'

// Keadaan kosong seragam: ikon, judul, penjelasan, dan (opsional) satu tombol tindak lanjut.
export default function Empty({ icon = 'info', title, children }: { icon?: string; title: string; children?: ReactNode }) {
  return <div className="empty"><Icon name={icon} size={28} /><b>{title}</b>{children && <p>{children}</p>}</div>
}
