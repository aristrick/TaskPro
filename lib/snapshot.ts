// Salinan keadaan kunjungan yang sedang berjalan, disimpan di HP. Dipakai agar aplikasi tetap bisa dibuka (dan check-out diantrekan)
// jika HP kehilangan sinyal lalu aplikasi dimuat ulang. Hanya ada satu salinan per akun dan kedaluwarsa dalam 24 jam.
import type { Kunjungan, Me, Produk, StokMap } from './types'
export type Snap = { t: number; me: Me; visit: Kunjungan; products: Produk[]; focus: string[]; minCo: number; tz: string; stok: StokMap; stokOn: boolean }
const kunci = (uid: string) => `taskpro-snap-${uid}`
const MAKS_MS = 24 * 3600e3
const gudang = (): Storage | null => { try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null } }

export function simpanSnap(s: Snap, g: Storage | null = gudang()) { try { g?.setItem(kunci(s.me.id), JSON.stringify(s)) } catch { /* abaikan */ } }
export function hapusSnap(uid: string, g: Storage | null = gudang()) { try { g?.removeItem(kunci(uid)) } catch { /* abaikan */ } }
export function muatSnap(uid: string, g: Storage | null = gudang(), now = Date.now()): Snap | null {
  try {
    const s = JSON.parse(g?.getItem(kunci(uid)) || 'null') as Snap | null
    return s && s.me?.id === uid && s.visit?.id && Array.isArray(s.products) && now - s.t < MAKS_MS ? s : null
  } catch { return null }
}
