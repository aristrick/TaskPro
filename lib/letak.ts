// Menentukan letak daftar pilihan yang melayang di bawah/atas kolomnya, supaya tidak pernah terpotong layar.
// `atas` dan `bawah` = ruang kosong (px) di atas dan di bawah kolom dalam layar yang terlihat.
export type Letak = { naik: boolean; tinggi: number }
export const TINGGI_MAKS = 300, TINGGI_MIN = 160, JARAK = 12   // JARAK = sisa tepi layar agar daftar tidak menempel ke ujung

export function letakDaftar(atas: number, bawah: number, butuh = TINGGI_MAKS): Letak {
  const a = Math.max(0, atas - JARAK), b = Math.max(0, bawah - JARAK)
  // Cukup di bawah: tetap turun ke bawah. Kalau tidak, pilih sisi yang lebih lega.
  const naik = b < Math.min(butuh, TINGGI_MIN + 60) && a > b
  const ruang = naik ? a : b
  return { naik, tinggi: Math.max(TINGGI_MIN, Math.min(butuh, Math.floor(ruang))) }
}
