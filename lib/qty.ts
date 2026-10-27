// Isian jumlah penjualan yang diketik manual. Aturannya dibuat longgar saat mengetik dan dirapikan saat selesai:
//  * kolom boleh kosong sementara (jumlah tersimpan tidak berubah sampai ada angka),
//  * boleh diawali nol ("02" = 2), hanya angka yang diterima, maksimal 4 digit,
//  * tidak boleh melebihi batas (sisa stok), dan jika dilampaui langsung dipotong ke batas.
export const MAKS_QTY = 9999
export function ketikQty(teks: string, maks: number): { teks: string; nilai: number | null } {
  const bersih = teks.replace(/\D/g, '').slice(0, 4)
  if (bersih === '') return { teks: '', nilai: null }
  const asli = parseInt(bersih, 10), n = Math.min(asli, MAKS_QTY, Math.max(0, maks))
  return { teks: n === asli ? bersih : String(n), nilai: n }
}
