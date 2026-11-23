'use client'
import { useEffect, useRef, useState } from 'react'
import Icon from '../Icon'
import { buzz } from '../../lib/hp'
import { barisSalin, salin } from '../../lib/salin'
import type { Outlet } from '../../lib/types'

// Konfirmasi check-in. Selain nama outlet, tampil alamat, kecamatan, dan kelurahan dengan tombol Salin,
// supaya frontliner bisa menempelkannya ke aplikasi kantor (yang harus diisi manual).
export default function CheckinDialog({ outlet, onBatal, onLanjut }: { outlet: Outlet | null; onBatal: () => void; onLanjut: (o: Outlet) => void }) {
  return outlet ? <Isi key={outlet.id} outlet={outlet} onBatal={onBatal} onLanjut={onLanjut} /> : null
}

function Isi({ outlet, onBatal, onLanjut }: { outlet: Outlet; onBatal: () => void; onLanjut: (o: Outlet) => void }) {
  const [tersalin, setTersalin] = useState<string | null>(null)
  const [gagal, setGagal] = useState(false)
  const box = useRef<HTMLDivElement>(null), timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const baris = barisSalin(outlet)

  useEffect(() => {
    const sebelum = document.activeElement as HTMLElement | null
    box.current?.querySelector<HTMLElement>('button.primary')?.focus()
    return () => { if (timer.current) clearTimeout(timer.current); sebelum?.focus?.() }
  }, [])

  async function tekanSalin(kunci: string, nilai: string) {
    const ok = await salin(nilai)
    if (timer.current) clearTimeout(timer.current)
    setGagal(!ok); setTersalin(ok ? kunci : null); if (ok) buzz(12)
    timer.current = setTimeout(() => { setTersalin(null); setGagal(false) }, 1600)
  }
  function key(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.stopPropagation(); onBatal() }
    else if (e.key === 'Tab') {   // fokus tidak keluar dari dialog
      const f = Array.from(box.current!.querySelectorAll<HTMLElement>('button')).filter(x => !(x as HTMLButtonElement).disabled)
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
  }

  return (
    <div className="overlay" onMouseDown={e => e.target === e.currentTarget && onBatal()} onKeyDown={key}>
      <div className="dialog checkin" role="dialog" aria-modal="true" aria-labelledby="ci-judul" ref={box}>
        <div className="dicon"><Icon name="pin" size={26} /></div>
        <h3 id="ci-judul">Check-in di outlet ini?</h3>
        <p className="ci-sub">Mulai kunjungan di <b>{outlet.name}</b>.</p>
        <ul className="salin-list" aria-label="Data outlet untuk disalin">
          {baris.map(b => {
            const ok = tersalin === b.kunci
            return <li key={b.kunci} className="salin-row">
              <div className="salin-teks"><small>{b.label}</small>{b.nilai ? <span>{b.nilai}</span> : <span className="kosong">Belum diisi</span>}</div>
              <button type="button" className={`salin-btn ${ok ? 'ok' : ''}`} disabled={!b.nilai} title={ok ? 'Tersalin' : `Salin ${b.label.toLowerCase()}`} aria-label={`Salin ${b.label.toLowerCase()}`} onClick={() => tekanSalin(b.kunci, b.nilai)}>
                {ok ? <IkonCentang /> : <IkonSalin />}<span className="sr-only" role="status">{ok ? 'Tersalin' : ''}</span></button>
            </li>
          })}
        </ul>
        <p className="salin-status err" role="status" aria-live="polite">{gagal ? 'Gagal menyalin. Tekan lama teks lalu pilih Salin.' : ''}</p>
        <div className="dbtns">
          <button className="ghost" onClick={onBatal}>Batal</button>
          <button className="primary" onClick={() => onLanjut(outlet)}>Check-in</button>
        </div>
      </div>
    </div>)
}

// Ikon dibuat di sini (bukan dari Icon.tsx) agar dialog tidak bergantung pada berkas ikon lain.
const svg = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const
const IkonSalin = () => <svg {...svg}><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H16" /></svg>
const IkonCentang = () => <svg {...svg}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
