import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bacaXlsx, buatXlsx, sederhanakan, MAKS_BYTE } from '../../lib/excel'
import { parseDmp } from '../../lib/dmp'

test('nilai sel disederhanakan: teks berformat, rumus, tautan, tanggal, error', () => {
  assert.equal(sederhanakan({ richText: [{ text: 'Wr ' }, { text: 'Budi' }] }), 'Wr Budi')
  assert.equal(sederhanakan({ formula: 'A1+1', result: 5 }), 5)
  assert.equal(sederhanakan({ text: 'klik', hyperlink: 'https://x' }), 'klik')
  assert.equal(sederhanakan(new Date('2026-10-21T10:00:00Z')), '2026-10-21')
  assert.equal(sederhanakan({ error: '#N/A' }), null); assert.equal(sederhanakan(undefined), null); assert.equal(sederhanakan(0), 0); assert.equal(sederhanakan(''), '')
})

test('tulis lalu baca: judul kolom, angka tetap angka, kolom campuran, nama sheet', async () => {
  const buf = await buatXlsx('OUTLET', [{ Nama: 'Warung A', Lat: -6.2, Aktif: true }, { Nama: 'Warung B', Lat: '', Extra: 'x' }])
  const [s] = await bacaXlsx(buf)
  assert.equal(s.nama, 'OUTLET'); assert.deepEqual(s.baris[0], ['Nama', 'Lat', 'Aktif', 'Extra'])
  assert.deepEqual(s.baris[1], ['Warung A', -6.2, true, '']); assert.equal(s.baris[2][0], 'Warung B'); assert.equal(s.baris[2][3], 'x')
})

test('file DMP hasil tulis bisa dibaca parseDmp seperti sebelumnya', async () => {
  const H = ['code outlet', 'name', 'category', 'account', 'full_address', 'latitude', 'longitude', 'KODE MD', 'RAYON', 'CYCLE', 'STATUS']
  const buf = await buatXlsx('DMP', [])                                  // sheet kosong dulu: harus tetap terbaca tanpa error
  assert.equal((await bacaXlsx(buf)).length, 1)
  const ExcelJS: any = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Sheet1'); ws.addRow(['LAPORAN DMP']); ws.addRow([]); ws.addRow(H)
  ws.addRow(['X1', 'Warung A', 'General Trade', 'Retail', 'Jl. A', -6.2, 106.8, '0300-TMTB01', 'R01', 'C1', 'AKTIF'])
  ws.addRow(['X2', 'Warung B', null, null, 'Jl. B', null, null, '0400-TMTB01', 'R01', null, null])
  const r = parseDmp((await bacaXlsx(await wb.xlsx.writeBuffer()))[0].baris as any[][], '0300')
  assert.equal(r.valid.length, 1); assert.equal(r.valid[0].lat, -6.2); assert.equal(r.valid[0].rayon, 1); assert.equal(r.rejected.length, 1); assert.match(r.rejected[0].reason, /KODE MD/)
})

test('file bukan xlsx dan file terlalu besar ditolak dengan pesan yang jelas', async () => {
  await assert.rejects(() => bacaXlsx(new TextEncoder().encode('a,b,c\n1,2,3').buffer as ArrayBuffer), /tidak bisa dibaca/)
  await assert.rejects(() => bacaXlsx(new ArrayBuffer(MAKS_BYTE + 1)), /terlalu besar/)
})
