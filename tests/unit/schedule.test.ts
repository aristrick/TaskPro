import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slotDariTanggal, labelSlot, labelRayon, parseRayon, petaJadwal, kunciSlot } from '../../lib/schedule'

test('Oktober 2026 (Senin pertama = 5): minggu dihitung Senin sampai Sabtu', () => {
  assert.deepEqual(slotDariTanggal('2026-10-05'), { minggu: 1, hari: 1 }); assert.deepEqual(slotDariTanggal('2026-10-10'), { minggu: 1, hari: 6 })
  assert.deepEqual(slotDariTanggal('2026-10-12'), { minggu: 2, hari: 1 }); assert.deepEqual(slotDariTanggal('2026-10-19'), { minggu: 3, hari: 1 })
  assert.deepEqual(slotDariTanggal('2026-10-26'), { minggu: 4, hari: 1 }); assert.deepEqual(slotDariTanggal('2026-10-28'), { minggu: 4, hari: 3 }); assert.deepEqual(slotDariTanggal('2026-10-31'), { minggu: 4, hari: 6 })
})
test('hari Minggu tidak punya jadwal', () => { assert.equal(slotDariTanggal('2026-10-04'), null); assert.equal(slotDariTanggal('2026-10-25'), null); assert.equal(slotDariTanggal('2026-02-01'), null) })
test('tanggal sebelum Senin pertama = lanjutan Minggu 4', () => {
  assert.deepEqual(slotDariTanggal('2026-10-01'), { minggu: 4, hari: 4 }); assert.deepEqual(slotDariTanggal('2026-10-03'), { minggu: 4, hari: 6 })
  assert.deepEqual(slotDariTanggal('2026-08-01'), { minggu: 4, hari: 6 })                // Agustus dimulai Sabtu, Senin pertama = 3
})
test('bulan yang dimulai Senin, dan Senin ke-5 tetap Minggu 4', () => {
  assert.deepEqual(slotDariTanggal('2026-06-01'), { minggu: 1, hari: 1 }); assert.deepEqual(slotDariTanggal('2026-06-22'), { minggu: 4, hari: 1 })
  assert.deepEqual(slotDariTanggal('2026-06-29'), { minggu: 4, hari: 1 }); assert.deepEqual(slotDariTanggal('2026-06-30'), { minggu: 4, hari: 2 })
  assert.deepEqual(slotDariTanggal('2026-02-02'), { minggu: 1, hari: 1 })                // Februari dimulai Minggu: Senin pertama = 2
})
test('batas bulan dan tahun: 31 Desember 2026 (Kamis)', () => { assert.deepEqual(slotDariTanggal('2026-12-31'), { minggu: 4, hari: 4 }); assert.deepEqual(slotDariTanggal('2026-12-07'), { minggu: 1, hari: 1 }); assert.deepEqual(slotDariTanggal('2027-01-01'), { minggu: 4, hari: 5 }) })
test('masukan tanggal yang rusak', () => { for (const t of ['', '2026-1-5', 'besok', '2026/10/05']) assert.equal(slotDariTanggal(t), null) })
test('setiap tanggal Senin sampai Sabtu sepanjang 2026 menghasilkan slot yang sah', () => {
  for (let i = 0; i < 365; i++) {
    const d = new Date(Date.UTC(2026, 0, 1 + i)), tgl = d.toISOString().slice(0, 10), s = slotDariTanggal(tgl)
    if (d.getUTCDay() === 0) assert.equal(s, null, tgl); else assert.ok(s && s.minggu >= 1 && s.minggu <= 4 && s.hari >= 1 && s.hari <= 6 && s.hari === d.getUTCDay(), tgl)
  }
})
test('label dan penguraian rayon', () => {
  assert.equal(labelSlot({ minggu: 4, hari: 3 }), 'Minggu 4 · Rabu'); assert.equal(labelRayon(5), 'R05'); assert.equal(labelRayon(24), 'R24')
  for (const [t, n] of [['R05', 5], ['r5', 5], ['5', 5], ['05', 5], [' R 24 ', 24], ['1', 1]] as const) assert.equal(parseRayon(t), n, t)
  for (const t of ['', 'R00', '0', 'R25', '25', 'R', 'abc', 'R1X', '-3']) assert.equal(parseRayon(t), null, t)
})
test('peta jadwal per slot', () => { const p = petaJadwal([{ id: 1, minggu: 1, hari: 1, rayon: 5 }, { id: 2, minggu: 4, hari: 6, rayon: 24 }]); assert.equal(p.get(kunciSlot({ minggu: 4, hari: 6 }))?.rayon, 24); assert.equal(p.get('2-2'), undefined) })
