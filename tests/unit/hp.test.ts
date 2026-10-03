import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import RekapTab from '../../components/hp/RekapTab'
import ProfileTab from '../../components/hp/ProfileTab'
import { meters, fmt } from '../../lib/hp'
import { day } from '../../lib/rekap'

const hariIni = day(new Date())
const rk = {
  [hariIni]: { value: 9000, oc: 3, visits: 4, outlets: [{ name: 'Warung A', value: 5000 }, { name: 'Warung B', value: 4000 }],
    prod: { DETERGEN: { qty: 8, value: 8000, focus: true, ec: 3 }, LAIN: { qty: 1, value: 1000, focus: false, ec: 1 } } },
}

test('Rekap: daftar hari menampilkan total bulan ini dan tiap tanggal', () => {
  const html = renderToStaticMarkup(h(RekapTab, { rk, sel: '', sub: '', tz: 'Asia/Jakarta', onPick: () => {} }))
  assert.match(html, /Bulan ini/); assert.match(html, /Rp 9\.000/); assert.match(html, /3 OC/); assert.match(html, /4 kunjungan/)
})

test('Rekap: rincian hari menampilkan EC produk fokus, per produk, dan outlet', () => {
  const html = renderToStaticMarkup(h(RekapTab, { rk, sel: hariIni, sub: 'fwd', tz: 'Asia/Jakarta', onPick: () => {} }))
  assert.match(html, /Total penjualan/); assert.match(html, /EC 3/); assert.match(html, /8 pcs/); assert.match(html, /Warung A/); assert.match(html, /Outlet bertransaksi/)
})

test('Rekap: kondisi memuat dan kosong', () => {
  assert.match(renderToStaticMarkup(h(RekapTab, { rk: null, sel: '', sub: '', tz: 'Asia/Jakarta', onPick: () => {} })), /aria-busy/)
  assert.match(renderToStaticMarkup(h(RekapTab, { rk: {}, sel: '', sub: '', tz: 'Asia/Jakarta', onPick: () => {} })), /Belum ada kunjungan/)
})

test('Profile: nama, User ID, ringkasan stok, dan tombol LOG OUT', () => {
  const html = renderToStaticMarkup(h(ProfileTab, { nama: 'AMIRUDDIN', userId: '0300-TMTB01', stokSum: { n: 2, pcs: 30, sisa: 12 }, onStok: () => {}, onLogout: () => {} }))
  assert.match(html, /AMIRUDDIN/); assert.match(html, /0300-TMTB01/); assert.match(html, /2 produk · 30 pcs \(sisa 12\)/); assert.match(html, /LOG OUT/)
  assert.match(renderToStaticMarkup(h(ProfileTab, { nama: 'X', userId: 'Y', stokSum: { n: 0, pcs: 0, sisa: 0 }, onStok: () => {}, onLogout: () => {} })), /Belum ada stok hari ini/)
})

test('jarak: 0,01 derajat bujur di lintang -6,2 sekitar 1,1 km', () => {
  const m = meters(-6.2, 106.8, -6.2, 106.81)
  assert.ok(m > 1090 && m < 1120, String(m)); assert.equal(meters(-6.2, 106.8, -6.2, 106.8), 0)
  assert.equal(fmt(850), '850 m'); assert.equal(fmt(2400), '2.4 km')
})
