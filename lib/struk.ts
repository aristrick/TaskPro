// Menyusun struk dari kunjungan yang sedang berjalan. Dipanggil SEBELUM check-out, selagi daftar produk dan jumlahnya masih ada.
import type { Struk } from './escpos'
import type { Kunjungan, Me, Produk } from './types'

export function susunStruk(p: { judul: string; footer: string; visit: Kunjungan; me: Me; produk: Produk[]; qty: Record<string, number>; tz: string; sekarang?: Date }): Struk | null {
  const rinci = p.produk.filter(x => p.qty[x.id] > 0)
  if (!rinci.length) return null
  return {
    judul: p.judul, footer: p.footer, nomor: String(p.visit.id).slice(0, 8).toUpperCase(),
    waktu: (p.sekarang ?? new Date()).toLocaleString('id-ID', { timeZone: p.tz, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    outlet: p.visit.outlets?.name || '', alamat: p.visit.outlets?.address || '', frontliner: p.me.nama, userId: p.me.user_id,
    items: rinci.map(x => ({ nama: x.product, qty: p.qty[x.id], harga: Number(x.price) })),
    total: rinci.reduce((a, x) => a + p.qty[x.id] * Number(x.price), 0),
  }
}
