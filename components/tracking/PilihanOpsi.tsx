'use client'
// Tombol pilihan kecil yang dipakai di Back Tracking dan OTJ. Satu tombol menyala; menekan lagi tombol yang menyala tidak membatalkan
// (isian wajib diganti dengan pilihan lain), sama seperti di Tracking Go.
export type Opsi<T extends string> = { nilai: T; label: string; ragam?: 'bad' | 'na' }

export default function PilihanOpsi<T extends string>({ label, nilai, opsi, onPilih, disabled }: { label: string; nilai: T | '' | undefined; opsi: Opsi<T>[]; onPilih: (v: T) => void; disabled?: boolean }) {
  return (
    <div className="tg-opsi" role="group" aria-label={label}>
      {opsi.map(o => <button key={o.nilai} type="button" className={o.ragam || ''} aria-pressed={nilai === o.nilai} disabled={disabled} onClick={() => onPilih(o.nilai)}>{o.label}</button>)}
    </div>)
}
export const OPSI_YA_TIDAK: Opsi<'ya' | 'tidak'>[] = [{ nilai: 'ya', label: 'Ya' }, { nilai: 'tidak', label: 'Tidak', ragam: 'bad' }]
export const OPSI_STATUS: Opsi<'Sesuai' | 'TS' | 'N/A'>[] = [{ nilai: 'Sesuai', label: 'Sesuai' }, { nilai: 'TS', label: 'TS', ragam: 'bad' }, { nilai: 'N/A', label: 'N/A', ragam: 'na' }]
export const OPSI_JAWAB: Opsi<'Ya' | 'Tidak' | 'N/A'>[] = [{ nilai: 'Ya', label: 'Ya' }, { nilai: 'Tidak', label: 'Tidak', ragam: 'bad' }, { nilai: 'N/A', label: 'N/A', ragam: 'na' }]
