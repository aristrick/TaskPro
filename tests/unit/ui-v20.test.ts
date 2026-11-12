import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { n, rentang, pintasanAktif } from '../../lib/angka'
import { ringkasAlamat } from '../../lib/hp'
import StatusChip from '../../components/ui/StatusChip'
import MenuAksi from '../../components/ui/MenuAksi'
import PintasanTanggal from '../../components/ui/Pintasan'

test('angka: pemisah ribuan gaya Indonesia, tanda hubung untuk kosong', () => {
  assert.equal(n(2210), '2.210'); assert.equal(n(12253), '12.253'); assert.equal(n(0), '0'); assert.equal(n(null), '-')
})

test('pintasan tanggal: hari ini, 7 hari, bulan ini', () => {
  const now = new Date('2026-11-12T05:00:00Z')
  assert.deepEqual(rentang('hari', now), { dari: '2026-11-12', sampai: '2026-11-12' })
  assert.deepEqual(rentang('tujuh', now), { dari: '2026-11-06', sampai: '2026-11-12' })
  assert.deepEqual(rentang('bulan', now), { dari: '2026-11-01', sampai: '2026-11-12' })
  assert.equal(pintasanAktif('2026-11-06', '2026-11-12', now), 'tujuh'); assert.equal(pintasanAktif('2026-10-01', '2026-11-12', now), null)
})

test('ringkas alamat: buang provinsi, kota, dan kode pos; maksimal dua bagian', () => {
  assert.equal(ringkasAlamat('Jl. Pulogadung No. 5, Kayu Putih, Pulo Gadung, Jakarta Timur, Daerah Khusus Ibukota Jakarta 13210'), 'Jl. Pulogadung No. 5, Kayu Putih')
  assert.equal(ringkasAlamat('Jl. Mawar 3, DKI Jakarta'), 'Jl. Mawar 3')
  assert.equal(ringkasAlamat('Daerah Khusus Ibukota Jakarta'), 'Daerah Khusus Ibukota Jakarta')   // jika semua bagian dibuang, tampilkan aslinya
  assert.equal(ringkasAlamat(null), '')
})

test('komponen bersama: chip status, menu aksi, dan pintasan tanggal', () => {
  assert.match(renderToStaticMarkup(h(StatusChip, { tone: 'on' }, 'Aktif')), /schip on/)
  const m = renderToStaticMarkup(h(MenuAksi, { label: 'Aksi untuk X', items: [{ label: 'Hapus', onClick: () => {}, danger: true }] }))
  assert.match(m, /aria-label="Aksi untuk X"/); assert.match(m, /aria-haspopup="menu"/); assert.doesNotMatch(m, /Hapus/)   // isi menu baru muncul saat dibuka
  const p = renderToStaticMarkup(h(PintasanTanggal, { dari: '2026-11-12', onPilih: () => {} }))
  assert.match(p, /Hari ini/); assert.match(p, /7 hari/); assert.match(p, /Bulan ini/)
})
