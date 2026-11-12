'use client'
import { useEffect, useId, useRef, useState } from 'react'
import Icon from '../Icon'

export type AksiItem = { label: string; icon?: string; onClick: () => void; danger?: boolean; disabled?: boolean }

// Menu "⋯" untuk aksi sekunder di baris tabel. Aksi berbahaya (Hapus, Logout paksa) disimpan di sini agar tidak menumpuk di tiap baris.
export default function MenuAksi({ items, label = 'Aksi lainnya' }: { items: AksiItem[]; label?: string }) {
  const [buka, setBuka] = useState(false)
  const ref = useRef<HTMLDivElement>(null), id = useId()
  useEffect(() => {
    if (!buka) return
    const tutup = (e: MouseEvent | KeyboardEvent) => { if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setBuka(false) }
    document.addEventListener('mousedown', tutup); document.addEventListener('keydown', tutup)
    return () => { document.removeEventListener('mousedown', tutup); document.removeEventListener('keydown', tutup) }
  }, [buka])
  return (
    <div className="menuaksi" ref={ref}>
      <button type="button" className="ghost iconbtn" aria-label={label} aria-haspopup="menu" aria-expanded={buka} aria-controls={id} onClick={e => { e.stopPropagation(); setBuka(b => !b) }}><Icon name="dots" size={18} /></button>
      {buka && <div className="menuaksi-list" role="menu" id={id}>
        {items.map(x => <button key={x.label} type="button" role="menuitem" disabled={x.disabled} className={`menuaksi-item ${x.danger ? 'danger' : ''}`}
          onClick={e => { e.stopPropagation(); setBuka(false); x.onClick() }}>{x.icon && <Icon name={x.icon} size={18} />}{x.label}</button>)}
      </div>}
    </div>)
}
