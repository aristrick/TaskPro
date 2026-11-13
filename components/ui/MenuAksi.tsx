'use client'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from '../Icon'

export type AksiItem = { label: string; icon?: string; onClick: () => void; danger?: boolean; disabled?: boolean }

// Menu "⋯" untuk aksi sekunder di baris tabel. Aksi berbahaya (Hapus, Logout paksa) disimpan di sini agar tidak menumpuk di tiap baris.
export default function MenuAksi({ items, label = 'Aksi lainnya' }: { items: AksiItem[]; label?: string }) {
  const [buka, setBuka] = useState(false)
  const ref = useRef<HTMLDivElement>(null), daftar = useRef<HTMLDivElement>(null), id = useId()
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  // Daftar ditampilkan di luar tabel (portal + fixed) agar tidak terpotong wadah yang bisa di-scroll; membuka ke atas bila ruang di bawah kurang
  useLayoutEffect(() => {
    if (!buka) { setPos(null); return }
    const b = ref.current!.getBoundingClientRect(), h = daftar.current?.offsetHeight || 0
    const bawah = b.bottom + 6, muat = bawah + h <= window.innerHeight - 8
    setPos({ top: muat ? bawah : Math.max(8, b.top - 6 - h), right: Math.max(8, window.innerWidth - b.right) })
  }, [buka])
  useEffect(() => {
    if (!buka) return
    const tutup = (e: MouseEvent | KeyboardEvent) => { if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node) && !daftar.current?.contains(e.target as Node)) setBuka(false) }
    const tutupSaja = () => setBuka(false)
    document.addEventListener('mousedown', tutup); document.addEventListener('keydown', tutup)
    window.addEventListener('scroll', tutupSaja, true); window.addEventListener('resize', tutupSaja)
    return () => { document.removeEventListener('mousedown', tutup); document.removeEventListener('keydown', tutup); window.removeEventListener('scroll', tutupSaja, true); window.removeEventListener('resize', tutupSaja) }
  }, [buka])
  return (
    <div className="menuaksi" ref={ref}>
      <button type="button" className="ghost iconbtn" aria-label={label} aria-haspopup="menu" aria-expanded={buka} aria-controls={id} onClick={e => { e.stopPropagation(); setBuka(b => !b) }}><Icon name="dots" size={18} /></button>
      {buka && createPortal(<div className="menuaksi-list" role="menu" id={id} ref={daftar} style={{ position: 'fixed', top: pos?.top ?? 0, right: pos?.right ?? 0, left: 'auto', zIndex: 70, visibility: pos ? 'visible' : 'hidden' }}>
        {items.map(x => <button key={x.label} type="button" role="menuitem" disabled={x.disabled} className={`menuaksi-item ${x.danger ? 'danger' : ''}`}
          onClick={e => { e.stopPropagation(); setBuka(false); x.onClick() }}>{x.icon && <Icon name={x.icon} size={18} />}{x.label}</button>)}
      </div>, document.body)}
    </div>)
}
