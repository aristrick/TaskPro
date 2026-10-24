// Logout otomatis untuk akun admin (MDS, RMDM, MDM) yang tidak beraktivitas. Frontliner tidak terkena: mereka bekerja di lapangan dan harus tetap masuk.
export const BATAS_MENIT = 30           // tanpa aktivitas selama ini = keluar otomatis
export const PERINGATAN_DETIK = 60      // peringatan muncul sebanyak ini sebelum batas
export const KUNCI_AKTIF = 'taskpro-aktif'          // waktu aktivitas terakhir (ms), dibagi antar tab dan bertahan saat halaman ditutup
export const KUNCI_INFO = 'taskpro-info-login'      // pesan untuk halaman login setelah keluar otomatis
export const ROLE_INAKTIF = ['mds', 'rmdm', 'mdm']

export type StatusInaktif = { status: 'aktif' | 'peringatan' | 'habis'; sisaDetik: number }

export const perluInaktif = (role?: string | null) => !!role && ROLE_INAKTIF.includes(role)

// `terakhir` yang lebih baru dari `sekarang` (jam diubah mundur) dianggap sekarang, supaya sesi tidak bisa diperpanjang dengan mengubah jam.
export function statusInaktif(terakhir: number, sekarang: number, batasMenit = BATAS_MENIT, peringatanDetik = PERINGATAN_DETIK): StatusInaktif {
  const sisaMs = batasMenit * 60_000 - (sekarang - Math.min(terakhir, sekarang))
  if (sisaMs <= 0) return { status: 'habis', sisaDetik: 0 }
  return { status: sisaMs <= peringatanDetik * 1000 ? 'peringatan' : 'aktif', sisaDetik: Math.ceil(sisaMs / 1000) }
}
