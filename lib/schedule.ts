// Schedule Taskforce: jadwal rayon per frontliner. Siklus 4 minggu x 6 hari (Senin sampai Sabtu) = 24 hari = 24 rayon; tiap hari satu rayon.
export const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const
export const MINGGU = [1, 2, 3, 4] as const
export type Slot = { minggu: number; hari: number }                    // hari 1 = Senin ... 6 = Sabtu
export type BarisJadwal = { id: number; minggu: number; hari: number; rayon: number }

export const kunciSlot = (s: Slot) => `${s.minggu}-${s.hari}`
export const labelSlot = (s: Slot) => `Minggu ${s.minggu} · ${HARI[s.hari - 1]}`
export const labelRayon = (n: number) => `R${String(n).padStart(2, '0')}`
// Menerima "R05", "r5", "5", "05". Selain rayon 1 sampai 24 = null.
export function parseRayon(teks: string): number | null {
  const m = /^\s*r?\s*0*(\d{1,2})\s*$/i.exec(teks); if (!m) return null
  const n = Number(m[1]); return n >= 1 && n <= 24 ? n : null
}

// ATURAN MINGGU (satu-satunya tempat aturan ini ditulis; ubah di sini jika cara menghitung minggu di tim berbeda):
//  * Minggu dihitung Senin sampai Sabtu, dimulai dari Senin pertama setiap bulan. Minggu 1 = minggu yang berisi Senin pertama.
//  * Tanggal sebelum Senin pertama dianggap lanjutan Minggu 4 (minggu terakhir bulan sebelumnya).
//  * Senin ke-5 dan seterusnya dalam bulan tetap Minggu 4 (jadwal hanya punya 4 minggu).
//  * Hari Minggu tidak punya jadwal (null).
// `tgl` = tanggal lokal cabang berbentuk YYYY-MM-DD.
export function slotDariTanggal(tgl: string): Slot | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tgl); if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const hari = new Date(Date.UTC(y, mo - 1, d)).getUTCDay()           // 0 = Minggu
  if (hari === 0) return null
  const hariPertama = new Date(Date.UTC(y, mo - 1, 1)).getUTCDay()
  const seninPertama = 1 + ((8 - hariPertama) % 7)
  const minggu = d < seninPertama ? 4 : Math.min(4, Math.floor((d - seninPertama) / 7) + 1)
  return { minggu, hari }
}

export const petaJadwal = (baris: BarisJadwal[]) => new Map(baris.map(b => [kunciSlot(b), b]))
