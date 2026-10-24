import { test } from 'node:test'
import assert from 'node:assert/strict'
import { statusInaktif, perluInaktif, BATAS_MENIT } from '../../lib/inaktif'

const mnt = (n: number) => n * 60_000
test('hanya MDS, RMDM, dan MDM yang kena logout otomatis', () => {
  for (const r of ['mds', 'rmdm', 'mdm']) assert.ok(perluInaktif(r), r)
  for (const r of ['frontliner', 'tl', 'kormot', '', undefined, null]) assert.ok(!perluInaktif(r), String(r))
})
test('batas 30 menit: aktif, peringatan 1 menit terakhir, lalu habis', () => {
  assert.equal(BATAS_MENIT, 30); const t0 = 1_000_000
  assert.deepEqual(statusInaktif(t0, t0), { status: 'aktif', sisaDetik: 1800 })
  assert.deepEqual(statusInaktif(t0, t0 + mnt(10)), { status: 'aktif', sisaDetik: 1200 })
  assert.equal(statusInaktif(t0, t0 + mnt(28) + 59_000).status, 'aktif')
  assert.deepEqual(statusInaktif(t0, t0 + mnt(29)), { status: 'peringatan', sisaDetik: 60 })
  assert.deepEqual(statusInaktif(t0, t0 + mnt(29) + 30_000), { status: 'peringatan', sisaDetik: 30 })
  assert.deepEqual(statusInaktif(t0, t0 + mnt(30)), { status: 'habis', sisaDetik: 0 }); assert.equal(statusInaktif(t0, t0 + mnt(500)).status, 'habis')
})
test('jam yang diubah mundur tidak memperpanjang sesi', () => {
  const sekarang = 5_000_000
  assert.equal(statusInaktif(sekarang + mnt(120), sekarang).sisaDetik, 1800)   // dianggap aktivitas barusan, bukan 2 jam ke depan
  assert.equal(statusInaktif(sekarang - mnt(31), sekarang).status, 'habis')
})
