'use client'
import { useEffect, useState, type ReactNode } from 'react'
import Icon from '../Icon'

// Penjelasan bantuan yang bisa ditutup. Sekali ditutup, tidak muncul lagi di halaman itu (tersimpan di perangkat).
export default function TipBantuan({ id, judul, children }: { id: string; judul: string; children: ReactNode }) {
  const kunci = `tip:${id}`, [tampil, setTampil] = useState(false)
  useEffect(() => { try { setTampil(localStorage.getItem(kunci) !== '1') } catch { setTampil(true) } }, [kunci])
  if (!tampil) return null
  return <aside className="tip" aria-label={judul}>
    <span className="tip-ico"><Icon name="info" size={18} /></span>
    <div className="tip-body"><b>{judul}</b><div>{children}</div></div>
    <button type="button" className="ghost iconbtn" aria-label="Tutup petunjuk" onClick={() => { try { localStorage.setItem(kunci, '1') } catch { /* abaikan */ } setTampil(false) }}><Icon name="close" size={16} /></button>
  </aside>
}
