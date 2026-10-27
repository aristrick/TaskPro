import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ketikQty } from '../../lib/qty'

test('mengetik 20 atau 02 diterima apa adanya, tanpa harus diawali angka 1', () => {
  assert.deepEqual(ketikQty('2', 9999), { teks: '2', nilai: 2 }); assert.deepEqual(ketikQty('20', 9999), { teks: '20', nilai: 20 })
  assert.deepEqual(ketikQty('02', 9999), { teks: '02', nilai: 2 }); assert.deepEqual(ketikQty('007', 9999), { teks: '007', nilai: 7 })
})
test('kosong sementara tidak mengubah jumlah, dan 0 adalah angka yang sah', () => {
  assert.deepEqual(ketikQty('', 9999), { teks: '', nilai: null }); assert.deepEqual(ketikQty('0', 9999), { teks: '0', nilai: 0 }); assert.deepEqual(ketikQty('00', 9999), { teks: '00', nilai: 0 })
})
test('selain angka dibuang dan panjangnya dibatasi 4 digit', () => {
  assert.deepEqual(ketikQty('a1b2', 9999), { teks: '12', nilai: 12 }); assert.deepEqual(ketikQty('-5', 9999), { teks: '5', nilai: 5 }); assert.deepEqual(ketikQty('1.5', 9999), { teks: '15', nilai: 15 })
  assert.deepEqual(ketikQty('123456', 9999), { teks: '1234', nilai: 1234 }); assert.equal(ketikQty('abc', 9999).nilai, null)
})
test('tidak boleh melebihi batas (sisa stok): langsung dipotong ke batas', () => {
  assert.deepEqual(ketikQty('60', 50), { teks: '50', nilai: 50 }); assert.deepEqual(ketikQty('50', 50), { teks: '50', nilai: 50 }); assert.deepEqual(ketikQty('049', 50), { teks: '049', nilai: 49 })
  assert.deepEqual(ketikQty('7', 0), { teks: '0', nilai: 0 }); assert.equal(ketikQty('99999', 20000).nilai, 9999)
})
