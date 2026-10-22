// Antrean check-out untuk sinyal lemah. Jika check-out gagal karena jaringan, penjualan dan waktu check-out disimpan di HP
// lalu dikirim otomatis saat online. Aturan keamanan data:
//  * Check-in TIDAK diantrekan (butuh validasi radius dan waktu server).
//  * save_sales aman dikirim ulang (database menghapus lalu mengisi ulang penjualan kunjungan itu).
//  * Waktu check-out yang dikirim adalah waktu saat tombol ditekan (fungsi checkout_tertunda, migrasi 16). Jika fungsi itu belum ada
//    atau menolak waktunya, dipakai checkout() biasa agar kunjungan tidak menggantung.
//  * "Kunjungan tidak aktif" berarti kunjungan sudah ditutup (mis. pengiriman sebelumnya sebenarnya berhasil): dianggap selesai.
export type Penjualan = { product_id: string; qty: number }
export type Antrean = { visit_id: string; items: Penjualan[]; lat: number | null; lng: number | null; acc: number | null; at: string; outlet: string; dibuat: number }
export type GalatDb = { message?: string; code?: string } | null
export type Klien = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data?: unknown; error: GalatDb }> }
export type Ditolak = { item: Antrean; pesan: string }
export type Hasil = { terkirim: Antrean[]; menunggu: number; ditolak: Ditolak[] }

const KUNCI = 'taskpro-outbox'
const gudang = (): Storage | null => { try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null } }

export function muat(s: Storage | null = gudang()): Antrean[] {
  try {
    const x = JSON.parse(s?.getItem(KUNCI) || '[]')
    return Array.isArray(x) ? x.filter(a => a && typeof a.visit_id === 'string' && Array.isArray(a.items) && typeof a.at === 'string') : []
  } catch { return [] }
}
const tulis = (l: Antrean[], s: Storage | null) => { try { if (l.length) s?.setItem(KUNCI, JSON.stringify(l)); else s?.removeItem(KUNCI) } catch { /* penyimpanan penuh atau diblokir */ } }
export function antre(a: Antrean, s: Storage | null = gudang()) { tulis([...muat(s).filter(x => x.visit_id !== a.visit_id), a], s) }
export function hapus(visitId: string, s: Storage | null = gudang()) { tulis(muat(s).filter(x => x.visit_id !== visitId), s) }
export const adaUntuk = (visitId: string, s: Storage | null = gudang()) => muat(s).some(x => x.visit_id === visitId)

export function galatJaringan(e: unknown): boolean {
  const m = String((e as { message?: string })?.message ?? e ?? '')
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_internet|timed? ?out|timeout|aborterror|econn|enotfound|bad gateway|service unavailable|gateway time-?out|<html/i.test(m)
}
const fungsiHilang = (e: GalatDb) => e?.code === 'PGRST202' || /Could not find the function/i.test(e?.message || '')
const sudahSelesai = (e: GalatDb) => /Kunjungan tidak aktif/i.test(e?.message || '')
const waktuDitolak = (e: GalatDb) => /Waktu check-out tidak valid|Data tertunda lebih dari/i.test(e?.message || '')

type Satu = { s: 'selesai' } | { s: 'tunda' } | { s: 'ditolak'; pesan: string }
async function kirimSatu(k: Klien, a: Antrean): Promise<Satu> {
  const klasifikasi = (e: GalatDb): Satu => (sudahSelesai(e) ? { s: 'selesai' } : galatJaringan(e) ? { s: 'tunda' } : { s: 'ditolak', pesan: e?.message || 'Ditolak server.' })
  try {
    if (a.items.length) {
      const { error } = await k.rpc('save_sales', { p_visit: a.visit_id, p_items: a.items, p_lat: a.lat, p_lng: a.lng, p_acc: a.acc })
      if (error) return klasifikasi(error)
    }
    let { error } = await k.rpc('checkout_tertunda', { p_visit: a.visit_id, p_at: a.at })
    if (error && (fungsiHilang(error) || waktuDitolak(error))) ({ error } = await k.rpc('checkout', { p_visit: a.visit_id }))
    return error ? klasifikasi(error) : { s: 'selesai' }
  } catch (e) { return galatJaringan(e) ? { s: 'tunda' } : { s: 'ditolak', pesan: (e as Error)?.message || 'Gagal mengirim.' } }
}

let berjalan: Promise<Hasil> | null = null
// Kirim semua antrean (urut dari yang tertua). Berhenti di kegagalan jaringan pertama. Pemanggilan bersamaan berbagi satu proses.
export function kirimSemua(k: Klien, s: Storage | null = gudang()): Promise<Hasil> {
  if (berjalan) return berjalan
  berjalan = (async () => {
    const out: Hasil = { terkirim: [], menunggu: 0, ditolak: [] }
    const daftar = muat(s).sort((a, b) => a.dibuat - b.dibuat)
    for (let i = 0; i < daftar.length; i++) {
      const r = await kirimSatu(k, daftar[i])
      if (r.s === 'tunda') { out.menunggu = daftar.length - i; break }
      hapus(daftar[i].visit_id, s)
      if (r.s === 'selesai') out.terkirim.push(daftar[i]); else out.ditolak.push({ item: daftar[i], pesan: r.pesan })
    }
    return out
  })().finally(() => { berjalan = null })
  return berjalan
}
