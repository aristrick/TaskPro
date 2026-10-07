import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReceiptDialog from '../../components/ReceiptDialog'
import PrinterSettings from '../../components/PrinterSettings'
import { prefBawaan, strukContoh, muatPref, muatTerakhir } from '../../lib/printer'

const noop = () => {}

test('dialog struk: pratinjau, tombol Cetak dan Tidak cetak (batal), serta jalan ke pengaturan', () => {
  const p = prefBawaan(), html = renderToStaticMarkup(h(ReceiptDialog, { struk: strukContoh(p), pref: p, onClose: noop, onDone: noop, onSettings: noop }))
  assert.match(html, /Cetak struk\?/); assert.match(html, /Tidak cetak/); assert.match(html, />\s*Cetak\s*</); assert.match(html, /Pengaturan printer/)
  assert.match(html, /TOTAL\s+Rp 19\.300/); assert.match(html, /Warung Contoh/); assert.match(html, /role="dialog"/)
})

test('pengaturan printer: pilihan cara cetak, kertas, saklar tanya, dan tes cetak', () => {
  const html = renderToStaticMarkup(h(PrinterSettings, { pref: prefBawaan(), onChange: noop, onClose: noop, onToast: noop }))
  assert.match(html, /Bluetooth langsung/); assert.match(html, /RawBT \(Android\)/); assert.match(html, /Dialog cetak sistem/)
  assert.match(html, /58 mm/); assert.match(html, /80 mm/); assert.match(html, /role="switch"/); assert.match(html, /Tes cetak/)
})

test('di luar browser: pengaturan bawaan aman dan struk terakhir kosong', () => {
  const p = muatPref(); assert.equal(p.tanya, true); assert.equal(p.lebar, 32); assert.equal(muatTerakhir(), null)
})
