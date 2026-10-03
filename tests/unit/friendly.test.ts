import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isNetworkError, friendly } from '../../lib/friendly'

test('error jaringan dikenali dan diterjemahkan', () => {
  for (const m of ['TypeError: Failed to fetch', 'NetworkError when attempting to fetch resource.', 'Load failed']) assert.equal(isNetworkError({ message: m }), true)
  assert.match(friendly(new Error('Failed to fetch')), /Tidak ada koneksi/)
})
test('error biasa tampil apa adanya', () => {
  assert.equal(friendly({ message: 'Stok P1 tidak cukup. Sisa 0 pcs, diminta 5 pcs.' }), 'Stok P1 tidak cukup. Sisa 0 pcs, diminta 5 pcs.')
  assert.equal(friendly(null, 'cadangan'), 'cadangan')
})
