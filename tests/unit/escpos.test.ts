import { test } from 'node:test'
import assert from 'node:assert/strict'
import { asciiBersih, bungkus, kiriKanan, barisStruk, teksPolos, escpos, rawbtUrl, angka, type Struk } from '../../lib/escpos'

const struk: Struk = { judul: 'STRUK PENJUALAN', footer: 'Terima kasih', nomor: 'AB12CD34', waktu: '05/10/2026 09.12', outlet: 'Wr Sambel Seruit', alamat: 'Jalan Dokter KRT Radjiman Widyodiningrat, Cakung, Jakarta Timur',
  frontliner: 'Amiruddin', userId: '0300-TMTB01', total: 25100,
  items: [{ nama: 'MAX BIO+ DISHWASH LIQUID 650ML SUPER PANJANG', qty: 2, harga: 8000 }, { nama: 'MBP - BONTEH MATCHA', qty: 1, harga: 9100 }] }

test('ASCII bersih: aksen dihapus, simbol diganti, karakter asing jadi ?', () => {
  assert.equal(asciiBersih('Café × 2 · Rp'), 'Cafe x 2 - Rp'); assert.equal(asciiBersih('日本'), '??')
  assert.equal(angka(1234567), '1.234.567')
})
test('bungkus kata dan potong kata yang terlalu panjang', () => {
  assert.deepEqual(bungkus('satu dua tiga empat', 9), ['satu dua', 'tiga', 'empat']); assert.deepEqual(bungkus('abcdefghij', 4), ['abcd', 'efgh', 'ij']); assert.deepEqual(bungkus('', 5), [''])
})
test('kiriKanan selalu pas selebar kolom', () => {
  assert.equal(kiriKanan('TOTAL', 'Rp 1.000', 20).length, 20); assert.equal(kiriKanan('NAMA PRODUK YANG SANGAT PANJANG SEKALI', '99.000', 20).length, 20)
})
test('tidak ada baris yang melebihi lebar kertas (58 mm = 32 kolom, 80 mm = 48 kolom)', () => {
  for (const w of [32, 48]) for (const b of barisStruk(struk, w)) assert.ok(b.t.length <= w, `"${b.t}" ${b.t.length} > ${w}`)
})
test('isi struk: item, subtotal, total, dan nomor', () => {
  const t = teksPolos(barisStruk(struk, 32), 32)
  assert.match(t, /STRUK PENJUALAN/); assert.match(t, /2 x 8\.000\s+16\.000/); assert.match(t, /TOTAL\s+Rp 25\.100/); assert.match(t, /AB12CD34/); assert.match(t, /0300-TMTB01/); assert.match(t, /Terima kasih/)
})
test('ESC/POS: diawali reset printer, berisi teks, diakhiri dorong kertas dan potong', () => {
  const d = escpos(barisStruk(struk, 32))
  assert.deepEqual([...d.slice(0, 2)], [0x1b, 0x40]); assert.deepEqual([...d.slice(-4)], [0x1d, 0x56, 0x42, 0x00])
  assert.ok(Buffer.from(d).toString('latin1').includes('TOTAL')); assert.ok(d.every(b => b <= 0x7f))                    // murni ASCII/perintah
})
test('RawBT: format intent resmi dan isi base64 yang bisa dibaca kembali', () => {
  const d = Uint8Array.from([0x1b, 0x40, 0x41, 0x42]), u = rawbtUrl(d)
  assert.match(u, /^intent:base64,[A-Za-z0-9+/=]+#Intent;scheme=rawbt;package=ru\.a402d\.rawbtprinter;end;$/)
  assert.deepEqual([...Buffer.from(u.split(',')[1].split('#')[0], 'base64')], [0x1b, 0x40, 0x41, 0x42])
})
