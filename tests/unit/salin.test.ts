import { test } from 'node:test'
import assert from 'node:assert/strict'
import { barisSalin } from '../../lib/salin'

test('barisSalin: nama, alamat, kecamatan, kelurahan dirapikan dan urutannya tetap', () => {
  const b = barisSalin({ name: '  Wr  Sabel 5 ', address: 'Jl. Pik Penggilingan\nBlok G,  Cakung', district: 'Cakung', village: 'Penggilingan' })
  assert.deepEqual(b.map(x => x.kunci), ['nama', 'alamat', 'kecamatan', 'kelurahan'])
  assert.deepEqual(b.map(x => x.nilai), ['Wr Sabel 5', 'Jl. Pik Penggilingan Blok G, Cakung', 'Cakung', 'Penggilingan'])
})

test('barisSalin: data kosong atau null menjadi teks kosong (tombol salin dinonaktifkan di tampilan)', () => {
  const b = barisSalin({ name: 'Toko A', address: '', district: null, village: undefined })
  assert.deepEqual(b.map(x => x.nilai), ['Toko A', '', '', ''])
})
