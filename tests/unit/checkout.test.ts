import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { sisaDetik, mmss } from '../../lib/hp'
import MenitInput from '../../components/MenitInput'

const t0 = new Date('2026-10-06T02:00:00Z').getTime()
test('hitung mundur check-out: sisa detik, batas tepat, dan tanpa batas', () => {
  const ci = '2026-10-06T02:00:00Z'
  assert.equal(sisaDetik(ci, 3, t0), 180); assert.equal(sisaDetik(ci, 3, t0 + 60_000), 120); assert.equal(sisaDetik(ci, 3, t0 + 179_500), 1)
  assert.equal(sisaDetik(ci, 3, t0 + 180_000), 0); assert.equal(sisaDetik(ci, 3, t0 + 999_000), 0); assert.equal(sisaDetik(ci, 0, t0), 0)
})
test('format menit:detik', () => { assert.equal(mmss(180), '3:00'); assert.equal(mmss(65), '1:05'); assert.equal(mmss(9), '0:09'); assert.equal(mmss(0), '0:00') })
test('isian menit: tampil nilai, satuan, dan label untuk pembaca layar', () => {
  const html = renderToStaticMarkup(h(MenitInput, { value: 3, onSave: async () => true }))
  assert.match(html, /value="3"/); assert.match(html, /menit/); assert.match(html, /aria-label="Batas minimal check-out \(menit\)"/)
})
