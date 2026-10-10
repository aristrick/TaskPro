'use client'
import { useEffect, useState } from 'react'
import Icon from './Icon'
import { Spinner } from './Loaders'

// Isian angka menit yang menyimpan saat selesai diketik (Enter atau pindah kolom), dengan tanda sedang menyimpan, berhasil, atau gagal.
export default function MenitInput({ value, onSave, max = 120, label = 'Batas minimal check-out (menit)' }: { value: number; onSave: (n: number) => Promise<boolean>; max?: number; label?: string }) {
  const [v, setV] = useState(String(value)); const [st, setSt] = useState<'' | 'sim' | 'ok' | 'gagal'>('')
  useEffect(() => { setV(String(value)) }, [value])
  async function simpan() {
    const n = v === '' ? 0 : Number(v)
    if (!Number.isInteger(n) || n < 0 || n > max) { setSt('gagal'); setV(String(value)); setTimeout(() => setSt(''), 1800); return }
    if (n === value) { setV(String(n)); return }
    setSt('sim'); const ok = await onSave(n); setSt(ok ? 'ok' : 'gagal'); if (!ok) setV(String(value)); setTimeout(() => setSt(''), 1800)
  }
  return (
    <span className="menit">
      <input inputMode="numeric" aria-label={label} value={v} onChange={e => setV(e.target.value.replace(/\D/g, '').slice(0, 3))}
        onBlur={simpan} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
      <small>menit</small>
      {st === 'sim' && <Spinner size={14} />}{st === 'ok' && <Icon name="check" size={14} className="okc" />}{st === 'gagal' && <Icon name="close" size={14} className="badc" />}
    </span>)
}
