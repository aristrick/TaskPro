import { test } from 'node:test'
import assert from 'node:assert/strict'
import { letakDaftar, TINGGI_MAKS, TINGGI_MIN, JARAK } from '../../lib/letak'

test('ruang bawah cukup: daftar turun dengan tinggi penuh', () => {
  assert.deepEqual(letakDaftar(100, 600), { naik: false, tinggi: TINGGI_MAKS })
})
test('kartu paling bawah layar: daftar naik ke atas kolom agar tidak terpotong', () => {
  const l = letakDaftar(500, 90)   // hanya 90 px di bawah kolom, 500 px di atasnya
  assert.equal(l.naik, true); assert.ok(l.tinggi >= TINGGI_MIN && l.tinggi <= TINGGI_MAKS)
})
test('tinggi dibatasi ruang yang ada (dikurangi jarak tepi) tetapi tidak di bawah batas minimal', () => {
  assert.equal(letakDaftar(50, 250).tinggi, 250 - JARAK)                 // turun, muat 238 px
  assert.equal(letakDaftar(40, 60).tinggi, TINGGI_MIN)                   // dua sisi sempit: tetap bisa digulir dalam tinggi minimum
  assert.equal(letakDaftar(40, 60).naik, false)                          // ruang atas tidak lebih lega, jadi tetap ke bawah
})
test('ruang bawah sedang (cukup untuk daftar pendek): tidak berpindah sisi tanpa perlu', () => {
  assert.equal(letakDaftar(800, 260).naik, false)
})
