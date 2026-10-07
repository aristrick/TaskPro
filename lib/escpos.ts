// Susunan struk dan perintah printer thermal (ESC/POS). Murni (tanpa React/browser) agar bisa diuji.
export type Struk = {
  judul: string; footer: string; nomor: string; waktu: string
  outlet: string; alamat: string; frontliner: string; userId: string
  items: { nama: string; qty: number; harga: number }[]; total: number
}
export type Baris = { t: string; c?: boolean; b?: boolean }   // teks, rata tengah, tebal

// Printer thermal murah hanya paham ASCII: hilangkan aksen dan ganti karakter khusus.
export const asciiBersih = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[×✕]/g, 'x').replace(/[·•–—]/g, '-').replace(/[^\x20-\x7E]/g, '?')
export const angka = (n: number) => Math.round(n).toLocaleString('id-ID')

// Bungkus per kata sesuai lebar kolom; kata yang lebih panjang dari lebar dipotong.
export function bungkus(teks: string, lebar: number): string[] {
  const out: string[] = []; let cur = ''
  for (let w of teks.split(/\s+/).filter(Boolean)) {
    while (w.length > lebar) { if (cur) { out.push(cur); cur = '' } out.push(w.slice(0, lebar)); w = w.slice(lebar) }
    if (!cur) cur = w; else if (cur.length + 1 + w.length <= lebar) cur += ' ' + w; else { out.push(cur); cur = w }
  }
  if (cur) out.push(cur)
  return out.length ? out : ['']
}
// "kiri ........ kanan" dalam satu baris selebar `lebar`.
export function kiriKanan(kiri: string, kanan: string, lebar: number) {
  const k = kiri.length + kanan.length + 1 > lebar ? kiri.slice(0, Math.max(0, lebar - kanan.length - 1)) : kiri
  return k + ' '.repeat(Math.max(1, lebar - k.length - kanan.length)) + kanan
}

export function barisStruk(s: Struk, w: number): Baris[] {
  const B: Baris[] = [], garis = '-'.repeat(w)
  const tengah = (t: string, b = false) => { if (t.trim()) bungkus(asciiBersih(t), w).forEach(x => B.push({ t: x, c: true, b })) }
  tengah(s.judul, true); tengah(s.outlet, true); tengah(s.alamat)
  B.push({ t: garis })
  for (const [k, v] of [['No', s.nomor], ['Waktu', s.waktu], ['Sales', `${s.frontliner} (${s.userId})`]] as const) {
    const [pertama, ...sisa] = bungkus(asciiBersih(`${k.padEnd(5)}: ${v}`), w); B.push({ t: pertama }); sisa.forEach(x => B.push({ t: '       ' + x.trimStart() }))
  }
  B.push({ t: garis })
  for (const it of s.items) {
    bungkus(asciiBersih(it.nama), w).forEach(x => B.push({ t: x }))
    B.push({ t: kiriKanan(`  ${it.qty} x ${angka(it.harga)}`, angka(it.qty * it.harga), w) })
  }
  B.push({ t: garis })
  B.push({ t: kiriKanan('TOTAL', `Rp ${angka(s.total)}`, w), b: true })
  B.push({ t: garis })
  tengah(s.footer)
  return B
}

// Teks polos untuk pratinjau layar.
export const teksPolos = (B: Baris[], w: number) => B.map(x => (x.c ? ' '.repeat(Math.max(0, Math.floor((w - x.t.length) / 2))) + x.t : x.t)).join('\n')

// Byte ESC/POS: reset, rata tengah/kiri, tebal, teks ASCII, lalu dorong kertas dan potong (printer tanpa pemotong mengabaikannya).
export function escpos(B: Baris[]): Uint8Array {
  const o: number[] = [0x1b, 0x40]
  for (const x of B) { o.push(0x1b, 0x61, x.c ? 1 : 0, 0x1b, 0x45, x.b ? 1 : 0); for (const ch of asciiBersih(x.t)) o.push(ch.charCodeAt(0)); o.push(0x0a) }
  o.push(0x1b, 0x61, 0, 0x1b, 0x45, 0, 0x1b, 0x64, 4, 0x1d, 0x56, 0x42, 0x00)
  return Uint8Array.from(o)
}

// Android + aplikasi RawBT: format intent resmi RawBT (isi struk dikirim sebagai base64).
export function rawbtUrl(data: Uint8Array) {
  let bin = ''; for (let i = 0; i < data.length; i++) bin += String.fromCharCode(data[i])
  return `intent:base64,${btoa(bin)}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`
}
