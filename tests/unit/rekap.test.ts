import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rekap, day, jam, startOfDay, dur, rp } from '../../lib/rekap'

const sale = (q: number, focus = true, p = 'DETERGEN') => ({ qty: q, value: q * 1000, is_focus: focus, products: { product: p } })
const visit = (id: string, at: string, outlet: number, sales: any[], tz?: string) => ({ id, checkin_at: at, outlet_id: outlet, outlets: { name: 'O' + outlet }, sales, ...(tz ? { cabang: { tz } } : {}) })

test('EC, qty, OC, dan kunjungan mengikuti definisi (contoh: 3 outlet beli 2+2+4 pcs)', () => {
  const r = rekap([
    visit('a', '2026-09-29T01:00:00Z', 1, [sale(2)]),
    visit('b', '2026-09-29T02:00:00Z', 2, [sale(2), sale(1, false, 'LAIN')]),
    visit('c', '2026-09-29T03:00:00Z', 3, [sale(4)]),
    visit('d', '2026-09-29T04:00:00Z', 4, []),                         // kunjungan tanpa penjualan
  ])['2026-09-29']
  assert.equal(r.visits, 4)
  assert.equal(r.oc, 3)                                                // OC = outlet yang bertransaksi
  assert.equal(r.prod.DETERGEN.ec, 3)
  assert.equal(r.prod.DETERGEN.qty, 8)
  assert.equal(r.prod.DETERGEN.focus, true)
  assert.equal(r.prod.LAIN.focus, false)
  assert.equal(r.value, 9000)
})

test('outlet yang sama dua kali sehari dihitung satu OC dan satu EC', () => {
  const r = rekap([visit('a', '2026-09-29T01:00:00Z', 1, [sale(1)]), visit('b', '2026-09-29T05:00:00Z', 1, [sale(2)])])['2026-09-29']
  assert.equal(r.oc, 1); assert.equal(r.prod.DETERGEN.ec, 1); assert.equal(r.prod.DETERGEN.qty, 3); assert.equal(r.visits, 2)
})

test('zona waktu cabang menggeser batas hari (WIB vs WIT)', () => {
  const t = '2026-09-29T16:30:00Z'                                      // 23:30 WIB = 01:30 WIT esok harinya
  assert.equal(day(t, 'Asia/Jakarta'), '2026-09-29')
  assert.equal(day(t, 'Asia/Jayapura'), '2026-09-30')
  assert.deepEqual(Object.keys(rekap([visit('x', t, 1, [sale(1)], 'Asia/Jayapura')])), ['2026-09-30'])
  assert.deepEqual(Object.keys(rekap([visit('x', t, 1, [sale(1)])])), ['2026-09-29'])   // tanpa data cabang = WIB
})

test('format jam, durasi, rupiah, dan awal hari', () => {
  assert.equal(jam('2026-09-29T20:00:00Z'), '03:00:00')
  assert.equal(dur('2026-09-26T01:51:22Z', '2026-09-26T01:56:09Z'), '0:4:47')
  assert.equal(dur('2026-09-26T01:51:22Z', null), '')
  assert.equal(rp(1234567), 'Rp 1.234.567')
  assert.match(startOfDay('Asia/Jakarta'), /T00:00:00\+07:00$/)
  assert.match(startOfDay('Asia/Makassar'), /T00:00:00\+08:00$/)
  assert.match(startOfDay('Asia/Jayapura', 3), /T00:00:00\+09:00$/)
})
