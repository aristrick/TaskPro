import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import SalesTrend, { type TitikHari } from '../../components/SalesTrend'
import FocusProducts from '../../components/FocusProducts'
import { rpc, skala } from '../../lib/rekap'

const hari = (v: number[]): TitikHari[] => v.map((x, i) => ({ k: `2026-10-${14 + i}`, v: x, today: i === v.length - 1, l: ['Rab', 'Kam', 'Jum', 'Sab', 'Min', 'Sen', 'Sel'][i], tgl: `${14 + i} Okt`, lengkap: `Hari ${i}` }))

test('angka ringkas tanpa Rp dan skala sumbu yang rapi', () => {
  assert.equal(rpc(850000), '850 rb'); assert.equal(rpc(1200000), '1,2 jt')
  assert.deepEqual(skala(0), { top: 0, ticks: [0] })
  for (const m of [1, 999, 120000, 850000, 1234567, 98765432]) { const { top, ticks } = skala(m); assert.ok(top >= m, `${m} muat`); assert.equal(ticks.length, 5); assert.equal(ticks[4], top) }
  assert.deepEqual(skala(850000).ticks, [0, 250000, 500000, 750000, 1000000])
})

test('grafik 7 hari: ringkasan, sumbu, label hari, hari ini disorot', () => {
  const html = renderToStaticMarkup(h(SalesTrend, { seri: hari([0, 400000, 850000, 0, 1200000, 300000, 600000]) }))
  assert.match(html, /Total 7 hari/); assert.match(html, /Rp 3,4 jt/); assert.match(html, /Rata-rata per hari/); assert.match(html, /Hari terbaik/)
  assert.match(html, /1,2 jt/); assert.match(html, /850 rb/); assert.match(html, /Hari ini/); assert.match(html, /tcol today/); assert.match(html, /role="img"/)
  assert.equal((html.match(/class="tcol/g) || []).length, 7); assert.match(html, /tcol zero/)
})

test('grafik 7 hari tanpa penjualan: pesan kosong, bukan grafik rata', () => {
  const html = renderToStaticMarkup(h(SalesTrend, { seri: hari([0, 0, 0, 0, 0, 0, 0]) }))
  assert.match(html, /Belum ada penjualan/); assert.doesNotMatch(html, /tcol/)
})

test('produk fokus: EC dan Qty berlabel, hanya 5 teratas lebih dulu, ada tombol tampilkan semua', () => {
  const items = Array.from({ length: 7 }, (_, i) => ({ nama: `PRODUK ${i + 1}`, ec: 10 - i, qty: 100 - i * 10 }))
  const html = renderToStaticMarkup(h(FocusProducts, { items }))
  assert.match(html, /PRODUK 5/); assert.doesNotMatch(html, /PRODUK 6/); assert.match(html, /Tampilkan semua \(7\)/); assert.match(html, /<small>EC<\/small>/); assert.match(html, /<small>Qty<\/small>/)
  assert.doesNotMatch(renderToStaticMarkup(h(FocusProducts, { items: items.slice(0, 3) })), /Tampilkan semua/)
})
