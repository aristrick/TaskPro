import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseDmp, periksaFormatDmp, KOLOM_DMP } from '../../lib/dmp'
import { buatTemplateDmp } from '../../lib/dmp-template'
import { bacaXlsx } from '../../lib/excel'

const JUDUL = KOLOM_DMP.map(k => k.judul)
const data = (o: Record<string, string> = {}) => KOLOM_DMP.map(k => ({ 'code outlet': 'X1', name: 'Warung A', full_address: 'Jl. A', latitude: '-6.2', longitude: '106.9', 'kode md': '0300-TMTB01', rayon: 'R01', ...o })[k.nama] ?? '')
const lembar = (nama: string, ...baris: unknown[][]) => ({ nama, baris })

test('format sesuai: sheet, baris judul, jumlah baris, dan kolom tambahan dilaporkan', () => {
  const c = periksaFormatDmp([lembar('DMP', ['judul laporan'], [], [...JUDUL, 'Catatan'], data(), data({ 'code outlet': 'X2' }))])
  assert.equal(c.ok, true); assert.equal(c.sheet, 'DMP'); assert.equal(c.barisHeader, 3); assert.equal(c.jumlahBaris, 2); assert.deepEqual(c.tambahan, ['Catatan']); assert.deepEqual(c.hilang, [])
})
test('kolom "no" tidak dianggap kolom tambahan, huruf besar/kecil dan spasi di tepi diabaikan', () => {
  const c = periksaFormatDmp([lembar('S', ['No', ...JUDUL.map(j => `  ${j.toUpperCase()} `)], [1, ...data()])])
  assert.equal(c.ok, true); assert.deepEqual(c.tambahan, [])
})
test('kolom wajib hilang disebut dengan nama baku', () => {
  const c = periksaFormatDmp([lembar('DMP', ['code outlet', 'name', 'latitude', 'longitude', 'rayon'], ['1', 'a', '1', '1', 'R01'])])
  assert.equal(c.ok, false); assert.deepEqual(c.hilang, ['full_address', 'KODE MD'].map(x => x.toLowerCase())); assert.match(c.masalah[0], /Kolom wajib tidak ditemukan: full_address, KODE MD/)
})
test('nama yang mirip diberi petunjuk ganti nama (kode_md, Lat, Alamat), tanpa menerima file begitu saja', () => {
  const c = periksaFormatDmp([lembar('DMP', ['Code Outlet', 'Nama', 'Alamat', 'Lat', 'Long', 'kode_md', 'RAYON'], ['1', 'a', 'b', '1', '1', '0300-X', 'R01'])])
  assert.equal(c.ok, false)
  assert.deepEqual(c.mirip.map(m => [m.ada, m.seharusnya]).sort(), [['Alamat', 'full_address'], ['Lat', 'latitude'], ['Long', 'longitude'], ['Nama', 'name'], ['kode_md', 'KODE MD']])
  assert.ok(c.masalah.some(m => /"kode_md" hampir sama dengan "KODE MD"/.test(m)))
})
test('tidak ada baris judul yang dikenali, dan file tanpa sheet', () => {
  const c = periksaFormatDmp([lembar('Sheet1', ['a', 'b'], [1, 2])]); assert.equal(c.ok, false); assert.match(c.masalah[0], /Baris judul kolom tidak dikenali/)
  assert.equal(periksaFormatDmp([]).ok, false)
})
test('pemilihan sheet: DMP didahulukan, lalu sheet sesuai yang berisi data; contoh tidak ikut terbaca', () => {
  const kosong = lembar('DMP', JUDUL), contoh = lembar('CONTOH', JUDUL, data({ 'code outlet': 'CONTOH-001' })), lain = lembar('Data', JUDUL, data())
  assert.equal(periksaFormatDmp([kosong, contoh]).sheet, 'DMP')
  assert.equal(periksaFormatDmp([contoh, lain]).sheet, 'CONTOH')                            // tanpa sheet DMP: yang pertama sesuai dan berisi
  assert.equal(periksaFormatDmp([lembar('PETUNJUK', ['teks']), lain]).sheet, 'Data')
  assert.equal(periksaFormatDmp([lembar('X', ['code outlet', 'name']), lain]).sheet, 'Data') // sheet rusak tidak mengalahkan sheet yang sesuai
})
test('baris contoh dan STATUS salah ditolak; STATUS huruf kecil dirapikan; kosong dianggap AKTIF', () => {
  const sh = (...b: unknown[][]) => [JUDUL, ...b]
  const r = parseDmp(sh(data({ 'code outlet': 'CONTOH-001' }), data({ 'code outlet': 'B', status: 'Active' }), data({ 'code outlet': 'C', name: 'Toko C', status: 'inaktif' }), data({ 'code outlet': 'D', name: 'Toko D', status: '' }), data({ 'code outlet': 'E', name: 'Toko E', status: 'AKTIF' })), '0300')
  assert.deepEqual(r.valid.map(v => [v.src_id, v.status]), [['C', 'INAKTIF'], ['D', 'AKTIF'], ['E', 'AKTIF']])
  assert.match(r.rejected[0].reason, /Baris contoh/); assert.match(r.rejected[1].reason, /STATUS harus AKTIF atau INAKTIF/)
})

test('format contoh: tiga sheet, judul kolom persis, dropdown dan batas isian, dan lolos pemeriksaan sendiri', async () => {
  const buf = await buatTemplateDmp('0300'), sheets = await bacaXlsx(buf)
  assert.deepEqual(sheets.map(s => s.nama), ['DMP', 'CONTOH', 'PETUNJUK']); assert.deepEqual(sheets[0].baris[0], JUDUL)
  const c = periksaFormatDmp(sheets); assert.equal(c.ok, true); assert.equal(c.sheet, 'DMP'); assert.equal(c.jumlahBaris, 0)
  assert.ok(buf.byteLength < 600_000, `ukuran ${buf.byteLength}`)
  const contoh = parseDmp(sheets[1].baris.slice(0, 4), '0300'); assert.equal(contoh.valid.length, 0); assert.equal(contoh.rejected.length, 3); assert.ok(contoh.rejected.every(r => /Baris contoh/.test(r.reason)))
  const ExcelJS = (await import('exceljs')).default, wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf)
  const v = (wb.getWorksheet('DMP') as unknown as { dataValidations: { model: Record<string, { formulae: unknown[] }> } }).dataValidations.model
  assert.match(String(v['M2'].formulae[0]), /R01.*R24/); assert.equal(v['O2'].formulae[0], '"AKTIF,INAKTIF"'); assert.deepEqual(v['J2'].formulae, [-90, 90]); assert.deepEqual(v['K2'].formulae, [-180, 180]); assert.match(String(v['L2'].formulae[0]), /LEFT\(L2,5\)="0300-"/)
  assert.ok(v['M1500'] && !v['M1502'])
})
test('format contoh dengan kode cabang lain memakai kode itu di contoh dan aturan', async () => {
  const sheets = await bacaXlsx(await buatTemplateDmp('2100')); assert.match(String(sheets[1].baris[1][KOLOM_DMP.findIndex(k => k.nama === 'kode md')]), /^2100-/)
})
test('mengisi sheet DMP pada format contoh lalu memprosesnya: seluruh alur berjalan', async () => {
  const ExcelJS = (await import('exceljs')).default, wb = new ExcelJS.Workbook(); await wb.xlsx.load(await buatTemplateDmp('0300'))
  const ws = wb.getWorksheet('DMP')!; ws.addRow(data({ 'code outlet': '000123', name: 'Warung Baru' })); ws.addRow(data({ 'code outlet': '000124', name: 'Toko Baru', latitude: '', longitude: '' }))
  const sheets = await bacaXlsx(await wb.xlsx.writeBuffer()), c = periksaFormatDmp(sheets)
  assert.equal(c.ok, true); assert.equal(c.sheet, 'DMP'); assert.equal(c.jumlahBaris, 2)
  const r = parseDmp(sheets.find(s => s.nama === c.sheet)!.baris, '0300'); assert.equal(r.valid.length, 2); assert.equal(r.rejected.length, 0); assert.equal(r.valid[0].src_id, '000123'); assert.equal(r.valid[1].lat, null)
})
