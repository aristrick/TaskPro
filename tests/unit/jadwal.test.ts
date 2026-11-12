import { test } from 'node:test'
import assert from 'node:assert/strict'
import { adalahSenin, bacaJadwalHariIni, hariIniDi, hariTerisi, kodeRayon, labelHari, letakRayon, outletHari, perRayon, rayonHari, rayonUrut, ringkasRayon, seninDari, tambahHari, namaHari, type Baris, type OutletJadwal } from '../../lib/jadwal'

const b = (id: string, minggu: number, hari: number, rayon: number): Baris => ({ id, minggu, hari, rayon })
const o = (id: number, name: string, rayon: number | null, ext_id: string | null = null, address = 'jl. x'): OutletJadwal => ({ id, ext_id, name, address, rayon })

test('kode rayon dan label hari', () => {
  assert.equal(kodeRayon(5), 'R05'); assert.equal(kodeRayon(24), 'R24'); assert.equal(ringkasRayon([3, 12]), 'R03, R12')
  assert.equal(labelHari(2, 3), 'Minggu ke 2 · Rabu'); assert.equal(namaHari(7), 'Minggu'); assert.equal(namaHari(0), 'Minggu')
})
test('isi urut: Minggu 1 Senin = R01 sampai Minggu 4 Sabtu = R24, tiap rayon sekali', () => {
  assert.equal(rayonUrut(1, 1), 1); assert.equal(rayonUrut(1, 6), 6); assert.equal(rayonUrut(2, 1), 7); assert.equal(rayonUrut(4, 6), 24)
  const semua = [1, 2, 3, 4].flatMap(m => [1, 2, 3, 4, 5, 6].map(h => rayonUrut(m, h)))
  assert.equal(new Set(semua).size, 24)
})
test('rayon per hari, hari terisi, dan letak rayon', () => {
  const rows = [b('a', 1, 1, 5), b('b', 1, 1, 2), b('c', 1, 3, 7), b('d', 2, 1, 5)]
  assert.deepEqual(rayonHari(rows, 1, 1).map(x => x.rayon), [2, 5])   // terurut, satu hari boleh lebih dari satu rayon
  assert.deepEqual(rayonHari(rows, 3, 1), [])
  assert.equal(hariTerisi(rows, 1), 2); assert.equal(hariTerisi(rows, 2), 1); assert.equal(hariTerisi(rows, 4), 0)
  assert.deepEqual(letakRayon(rows, 5).map(x => `${x.minggu}/${x.hari}`), ['1/1', '2/1'])
})
test('outlet per hari: gabungan rayon, disaring nama/Outlet ID/alamat, outlet tanpa rayon diabaikan', () => {
  const per = perRayon([o(1, 'Wr Laila', 5, '111222333'), o(2, 'Wr Opik', 5, '444555666', 'sungai tiram'), o(3, 'Tk Jaya', 2), o(4, 'Tanpa rayon', null)])
  const h = outletHari([5, 2], per)
  assert.equal(h.total, 3); assert.deepEqual(h.tampil.map(x => x.name), ['Tk Jaya', 'Wr Laila', 'Wr Opik'])   // R02 dulu, lalu R05 urut nama
  assert.deepEqual(outletHari([5], per, '4445').tampil.map(x => x.name), ['Wr Opik'])          // cari lewat Outlet ID
  assert.deepEqual(outletHari([5], per, 'TIRAM').tampil.map(x => x.name), ['Wr Opik'])         // cari lewat alamat, tanpa membedakan huruf besar/kecil
  assert.equal(outletHari([5], per, 'zzz').total, 2)                                            // jumlah (lencana) tidak berubah karena pencarian
  assert.equal(outletHari([], per).total, 0)
})
test('jadwal_hari_ini dibaca aman', () => {
  assert.deepEqual(bacaJadwalHariIni({ locked: true, minggu: 2, hari: 3, rayon: [5, 6] }), { locked: true, minggu: 2, hari: 3, rayon: [5, 6] })
  assert.deepEqual(bacaJadwalHariIni({ locked: 'true', rayon: ['7', 99, 'x', 0] }), { locked: false, minggu: null, hari: null, rayon: [7] })   // hanya `true` sungguhan yang mengunci
  assert.equal(bacaJadwalHariIni(null), null); assert.equal(bacaJadwalHariIni('x'), null)
})
test('tanggal: Senin, awal minggu, dan penambahan hari', () => {
  assert.equal(adalahSenin('2026-11-02'), true); assert.equal(adalahSenin('2026-11-03'), false)
  assert.equal(adalahSenin('2026-02-30'), false); assert.equal(adalahSenin('bukan tanggal'), false)
  assert.equal(seninDari('2026-11-11'), '2026-11-09')   // Rabu -> Senin minggu itu
  assert.equal(seninDari('2026-11-15'), '2026-11-09')   // Minggu masih termasuk minggu yang sama
  assert.equal(seninDari('2026-11-09'), '2026-11-09')
  assert.equal(tambahHari('2026-11-09', -7), '2026-11-02'); assert.equal(tambahHari('2026-12-30', 3), '2027-01-02')
  assert.equal(hariIniDi('Asia/Jakarta', new Date('2026-11-10T20:00:00Z')), '2026-11-11')   // sudah lewat tengah malam WIB
  assert.equal(hariIniDi('Asia/Jayapura', new Date('2026-11-10T15:30:00Z')), '2026-11-11')
})

import { hariAwal } from '../../lib/jadwal'
test('hari yang dibuka otomatis: hari ini bila minggu berjalan, jika tidak hari terisi pertama, jika tidak Senin', () => {
  const rows = [b('a', 3, 4, 5), b('b', 3, 2, 6)]
  assert.equal(hariAwal(rows, 2, { minggu: 2, hari: 5 }), 5)      // minggu berjalan: hari ini
  assert.equal(hariAwal(rows, 3, { minggu: 2, hari: 5 }), 2)      // minggu lain: hari terisi pertama
  assert.equal(hariAwal(rows, 4, { minggu: 2, hari: 5 }), 1)      // minggu kosong: Senin
  assert.equal(hariAwal(rows, 2, { minggu: 2, hari: 7 }), 1)      // hari ini Minggu (tanpa jadwal): jangan memilih hari 7
  assert.equal(hariAwal(rows, 1, null), 1)
})
