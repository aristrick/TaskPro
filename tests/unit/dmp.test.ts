import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseDmp } from '../../lib/dmp'

const H = ['no', 'code outlet', 'name', 'category', 'account', 'full_address', 'latitude', 'longitude', 'KODE MD', 'RAYON', 'CYCLE', 'STATUS']
const row = (o: Partial<Record<string, any>>) => H.map(h => ({ 'code outlet': 'X1', name: 'Warung A', category: 'General Trade', account: 'Retail', full_address: 'Jl. A', latitude: '-6.2', longitude: '106.9', 'KODE MD': '0300-TMTB01', RAYON: 'R01', CYCLE: 'M4', STATUS: 'AKTIF', no: 1, ...o } as any)[h] ?? null)
const sheet = (...rows: any[][]) => [['judul'], [], H, ...rows]   // header bukan di baris pertama

test('header dicari otomatis dan baris valid dibaca benar', () => {
  const r = parseDmp(sheet(row({})), '0300')
  assert.equal(r.valid.length, 1); assert.equal(r.valid[0].rayon, 1); assert.equal(r.valid[0].lat, -6.2); assert.equal(r.valid[0].src_id, 'X1')
})

test('baris bermasalah ditolak dengan alasan yang jelas', () => {
  const r = parseDmp(sheet(
    row({ 'code outlet': 'A', full_address: '' }),                 // alamat kosong
    row({ 'code outlet': 'B', 'KODE MD': '0400-TMTB01' }),         // salah cabang
    row({ 'code outlet': 'C', RAYON: 'R25' }),                     // rayon di luar 1-24
    row({ 'code outlet': 'D', longitude: '' }),                    // lat/long setengah
    row({ 'code outlet': 'E', latitude: '200' }),                  // koordinat tidak valid
    row({ 'code outlet': 'F' }),                                   // valid
  ), '0300')
  assert.equal(r.valid.length, 1)
  assert.equal(r.rejected.length, 5)
  assert.match(r.rejected[0].reason, /Alamat/); assert.match(r.rejected[1].reason, /KODE MD/); assert.match(r.rejected[2].reason, /Rayon/)
})

test('data ganda dilewati: ID sama dan nama+koordinat sama', () => {
  const r = parseDmp(sheet(row({ 'code outlet': 'A' }), row({ 'code outlet': 'A', name: 'Lain' }), row({ 'code outlet': 'B' })), '0300')
  assert.equal(r.valid.length, 1); assert.equal(r.dupes.length, 2)
})

test('outlet tanpa koordinat tetap diterima', () => {
  const r = parseDmp(sheet(row({ latitude: '', longitude: '' })), '0300')
  assert.equal(r.valid.length, 1); assert.equal(r.valid[0].lat, null)
})

test('file tanpa kolom wajib ditolak dengan pesan jelas', () => {
  assert.throws(() => parseDmp([['a', 'b'], [1, 2]], '0300'), /Header tidak ditemukan/)
})
