import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import PilihanOpsi, { OPSI_JAWAB } from '../../components/tracking/PilihanOpsi'
import ChecklistOtj from '../../components/tracking/ChecklistOtj'
import { OTJ_TEMPLATES, butirBagian } from '../../lib/otj-template'
import type { Stop } from '../../lib/trackinggo'

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321'; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'anon'
const stop = (extra: Partial<Stop> = {}): Stop => ({ visitId: 'v1', outletId: 1, kode: '0300-0000001', nama: 'Toko Sari', alamat: 'Jl. A', lat: -6.2, lng: 106.9, checkinAt: '2026-09-29T01:00:00Z', checkoutAt: '2026-09-29T01:10:00Z', tz: 'Asia/Jakarta',
  durasiDtk: 600, jedaDtk: null, tumpangTindih: false, checkoutBedaHari: false, pertama: true, outletDibuat: null, items: [], total: 0, konfirmasi: null, ...extra })

test('PilihanOpsi: hanya pilihan aktif yang aria-pressed, dan bisa dinonaktifkan', () => {
  const html = renderToStaticMarkup(h(PilihanOpsi, { label: 'x', nilai: 'Tidak', opsi: OPSI_JAWAB, onPilih: () => {} }))
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1)
  assert.match(html, /aria-pressed="true"[^>]*>Tidak</)
  assert.match(renderToStaticMarkup(h(PilihanOpsi, { label: 'x', nilai: '', opsi: OPSI_JAWAB, onPilih: () => {}, disabled: true })), /disabled/)
})

test('ChecklistOtj: semua butir tampil dan judul subbagian muncul sekali', () => {
  const t = OTJ_TEMPLATES.Taskforce, butir = butirBagian(t, 'kunjungan')
  const html = renderToStaticMarkup(h(ChecklistOtj, { butir, jawab: { [butir[0].id]: 'Ya' }, onJawab: () => {} }))
  assert.equal((html.match(/class="tg-ceklis"/g) || []).length, butir.length)
  assert.equal((html.match(/3\. Penjualan/g) || []).length, 1)
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1)
})

test('KonfirmasiPanel: belum dikonfirmasi = tombol nama saja (formulir tertutup); sudah = ringkasan hasil', async () => {
  const { default: Panel } = await import('../../components/tracking/KonfirmasiPanel')
  const awal = renderToStaticMarkup(h(Panel, { stop: stop(), indeks: 0, posisi: { lat: -6.2, lng: 106.9, acc: 5 }, onTersimpan: () => {} }))
  assert.match(awal, /Toko Sari/); assert.match(awal, /0 m dari Anda/); assert.doesNotMatch(awal, /Simpan konfirmasi/); assert.doesNotMatch(awal, /Sudah dikonfirmasi/)
  const ind = (status: 'Sesuai' | 'TS' | 'N/A') => ({ status, keterangan: '' })
  const k = { id: 'k', visit_id: 'v1', toko_ada: true, penjualan_sesuai: false, jam_kunjungan: ind('N/A'), on_rayon: ind('Sesuai'), kunjungan_manual: ind('TS'), pv_satu: ind('Sesuai'), jarak_m: 12, oleh_nama: 'MDS Satu' } as unknown as NonNullable<Stop['konfirmasi']>
  const sudah = renderToStaticMarkup(h(Panel, { stop: stop({ konfirmasi: k }), indeks: 0, posisi: null, onTersimpan: () => {} }))
  assert.match(sudah, /Sudah dikonfirmasi/); assert.match(sudah, /Penjualan sesuai: Tidak/); assert.match(sudah, /Manual: TS/); assert.match(sudah, /oleh MDS Satu \(12 m dari outlet\)/)
})
