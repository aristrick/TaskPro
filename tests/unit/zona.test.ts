import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tzAcuan, labelTz, jendela, tglBulanDepan, hanyaBulan } from '../../lib/rekap'

test('zona acuan: paling timur di antara cabang yang terlihat; kosong = WIB', () => {
  assert.equal(tzAcuan([]), 'Asia/Jakarta'); assert.equal(tzAcuan(['Asia/Jakarta']), 'Asia/Jakarta')
  assert.equal(tzAcuan(['Asia/Jakarta', 'Asia/Makassar']), 'Asia/Makassar'); assert.equal(tzAcuan(['Asia/Jayapura', 'Asia/Jakarta', 'Asia/Makassar']), 'Asia/Jayapura')
  assert.equal(labelTz('Asia/Makassar'), 'WITA'); assert.equal(labelTz('Asia/Jayapura'), 'WIT'); assert.equal(labelTz('Asia/Jakarta'), 'WIB')
})
test('jendela rekap selebar zona terdepan sampai zona paling belakang, bulan depan lintas tahun', () => {
  assert.deepEqual(jendela('2026-10-01', '2026-11-01'), { from: '2026-10-01T00:00:00+09:00', to: '2026-11-01T00:00:00+07:00' })
  assert.equal(tglBulanDepan('2026-12-15'), '2027-01-01'); assert.equal(tglBulanDepan('2026-10-21'), '2026-11-01')
  // kunjungan WIB pukul 23:30 tanggal 30 Sep = 16:30 UTC; harus ada di dalam jendela Oktober? tidak (milik September), tetapi tidak boleh membuat total Oktober salah
  const mentah = { '2026-09-30': { v: 1 }, '2026-10-01': { v: 2 }, '2026-10-31': { v: 3 }, '2026-11-01': { v: 4 } }
  assert.deepEqual(Object.keys(hanyaBulan(mentah, '2026-10-21')), ['2026-10-01', '2026-10-31'])
})
