// Format angka seragam (pemisah ribuan gaya Indonesia: 12.253). Dipakai di semua kartu dan tabel agar tidak ada angka polos tanpa pemisah.
export const n = (v: number | null | undefined) => (v == null || Number.isNaN(v) ? '-' : Number(v).toLocaleString('id-ID'))

// Pintasan rentang tanggal untuk halaman laporan. Memakai zona waktu yang sama dengan day() di lib/rekap agar tanggalnya cocok dengan data.
import { day } from './rekap'
export type Pintasan = 'hari' | 'tujuh' | 'bulan'
export function rentang(p: Pintasan, now: Date = new Date()): { dari: string; sampai: string } {
  const sampai = day(now)
  if (p === 'hari') return { dari: sampai, sampai }
  if (p === 'tujuh') return { dari: day(new Date(now.getTime() - 6 * 864e5)), sampai }
  return { dari: sampai.slice(0, 8) + '01', sampai }
}
export function pintasanAktif(dari: string, sampai: string, now: Date = new Date()): Pintasan | null {
  for (const p of ['hari', 'tujuh', 'bulan'] as Pintasan[]) { const r = rentang(p, now); if (r.dari === dari && r.sampai === sampai) return p }
  return null
}
