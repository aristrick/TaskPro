import { test, expect, type Page } from '@playwright/test'
import ExcelJS from 'exceljs'
import { buatMock, pasang } from './mock'
import { KOLOM_DMP } from '../../lib/dmp'

test.use({ viewport: { width: 1280, height: 900 } })
const JUDUL = KOLOM_DMP.map(k => k.judul)
const baris = (o: Record<string, string> = {}) => KOLOM_DMP.map(k => ({ 'code outlet': 'X1', name: 'Warung A', full_address: 'Jl. A', latitude: '-6.2', longitude: '106.9', 'kode md': '0300-TMTB01', rayon: 'R01', status: 'AKTIF', ...o })[k.nama] ?? '')
async function file(rows: unknown[][], nama = 'DMP.xlsx', sheet = 'DMP') {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet(sheet); rows.forEach(r => ws.addRow(r))
  return { name: nama, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(await wb.xlsx.writeBuffer()) }
}
async function siap(page: Page) {
  const m = buatMock({ role: 'mdm' }); await pasang(page, m); await page.goto('/import'); await expect(page.locator('.pagehead h2')).toHaveText('Import DMP')
  await page.getByLabel('Cabang tujuan impor').selectOption({ label: '0300 Pulogadung' }); return m
}
const unggah = (page: Page, f: Awaited<ReturnType<typeof file>>) => page.getByLabel('File DMP (.xlsx)').setInputFiles(f)

test('sebelum memilih cabang: unggah dan unduh format dikunci, dengan penjelasan', async ({ page }) => {
  await pasang(page, buatMock({ role: 'mdm' })); await page.goto('/import')
  await expect(page.getByLabel('File DMP (.xlsx)')).toBeDisabled(); await expect(page.getByRole('button', { name: 'Unduh format contoh' })).toBeDisabled()
  await expect(page.getByText('Pilih cabang dulu agar format contoh memakai kode cabang yang benar.')).toBeVisible()
})

test('unduh format contoh: nama berkas, tiga sheet, dan judul kolom persis', async ({ page }) => {
  await siap(page); await expect(page.getByText('KODE MD harus diawali 0300-')).toBeVisible()
  const [unduhan] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Unduh format contoh' }).click()])
  expect(unduhan.suggestedFilename()).toBe('Format_DMP_0300.xlsx')
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile((await unduhan.path())!)
  expect(wb.worksheets.map(w => w.name)).toEqual(['DMP', 'CONTOH', 'PETUNJUK'])
  expect((wb.getWorksheet('DMP')!.getRow(1).values as string[]).slice(1)).toEqual(JUDUL)
  expect(String(wb.getWorksheet('CONTOH')!.getRow(2).getCell(12).value)).toBe('0300-TMTB01')
})

test('format contoh yang diisi bisa langsung diunggah dan disimpan', async ({ page }) => {
  const m = await siap(page)
  const [unduhan] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Unduh format contoh' }).click()])
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile((await unduhan.path())!)
  const ws = wb.getWorksheet('DMP')!; ws.addRow(baris({ 'code outlet': '000123', name: 'Warung Baru' })); ws.addRow(baris({ 'code outlet': '000124', name: 'Toko Baru', latitude: '', longitude: '' }))
  await page.getByLabel('File DMP (.xlsx)').setInputFiles({ name: 'diisi.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from(await wb.xlsx.writeBuffer()) })
  await expect(page.getByText('Format sesuai.')).toBeVisible(); await expect(page.getByText('sheet “DMP”')).toBeVisible()
  await expect(page.getByText('2 outlet siap disimpan')).toBeVisible(); await expect(page.getByText('1 tanpa koordinat')).toBeVisible()
  await page.getByRole('button', { name: 'Simpan 2 outlet' }).click()
  await expect.poll(() => m.outletMasuk.length).toBe(1)
  expect(m.outletMasuk[0].map(o => [o.src_id, o.name, o.kode_md, o.rayon, o.status, o.cabang_id])).toEqual([['000123', 'Warung Baru', '0300-TMTB01', 1, 'AKTIF', 'cab-1'], ['000124', 'Toko Baru', '0300-TMTB01', 1, 'AKTIF', 'cab-1']])
  await expect(page.getByText('Selesai: 2 outlet tersimpan.')).toBeVisible()
})

test('format contoh yang belum diisi: format sesuai tetapi diminta mengisi data dulu', async ({ page }) => {
  await siap(page); await unggah(page, await file([JUDUL]))
  await expect(page.getByText('Format sesuai.')).toBeVisible(); await expect(page.getByText(/belum ada baris data/)).toBeVisible(); await expect(page.getByRole('button', { name: /Simpan/ })).toHaveCount(0)
})

test('nama kolom salah: file tidak diproses, kolom yang kurang dan petunjuk ganti nama disebut, ada tombol unduh format', async ({ page }) => {
  const m = await siap(page)
  await unggah(page, await file([['Code Outlet', 'Nama', 'Alamat', 'Lat', 'Long', 'kode_md', 'RAYON'], ['1', 'a', 'b', '-6.2', '106.9', '0300-X', 'R01']]))
  const kotak = page.getByRole('alert').filter({ hasText: 'Format file belum sesuai' })
  await expect(kotak).toContainText('Kolom wajib tidak ditemukan: name, full_address, latitude, longitude, KODE MD')
  await expect(kotak).toContainText('Kolom "kode_md" hampir sama dengan "KODE MD". Ganti namanya persis menjadi "KODE MD".'); await expect(kotak).toContainText('Kolom "Lat" hampir sama dengan "latitude"')
  await expect(page.getByText('2 outlet siap disimpan')).toHaveCount(0); await expect(page.getByRole('button', { name: /^Simpan/ })).toHaveCount(0); expect(m.outletMasuk).toHaveLength(0)
  const [u] = await Promise.all([page.waitForEvent('download'), kotak.getByRole('button', { name: 'Unduh format contoh' }).click()]); expect(u.suggestedFilename()).toBe('Format_DMP_0300.xlsx')
})

test('file yang bukan .xlsx ditolak dengan petunjuk cara menyimpan ulang', async ({ page }) => {
  await siap(page); await page.getByLabel('File DMP (.xlsx)').setInputFiles({ name: 'dmp.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b\n1,2') })
  await expect(page.getByText(/File harus berformat \.xlsx/)).toBeVisible(); await expect(page.getByText(/Save As/)).toBeVisible()
})

test('file rusak berekstensi .xlsx: pesan jelas, bukan layar kosong', async ({ page }) => {
  await siap(page); await page.getByLabel('File DMP (.xlsx)').setInputFiles({ name: 'rusak.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('bukan file excel') })
  await expect(page.getByText(/File tidak bisa dibaca/)).toBeVisible()
})

test('isi bermasalah dilaporkan per baris: baris contoh, STATUS salah, KODE MD cabang lain, rayon di luar rentang', async ({ page }) => {
  const m = await siap(page)
  await unggah(page, await file([JUDUL, baris({ 'code outlet': 'CONTOH-001', name: 'A' }), baris({ 'code outlet': 'B', name: 'B', status: 'Active' }), baris({ 'code outlet': 'C', name: 'C', 'kode md': '0400-TMTB01' }), baris({ 'code outlet': 'D', name: 'D', rayon: 'R99' }), baris({ 'code outlet': 'E', name: 'E' })]))
  await expect(page.getByText('Format sesuai.')).toBeVisible(); await expect(page.getByText('1 outlet siap disimpan')).toBeVisible()
  const tabel = page.getByRole('table'); await expect(tabel).toContainText('Baris contoh dari file format'); await expect(tabel).toContainText('STATUS harus AKTIF atau INAKTIF'); await expect(tabel).toContainText('KODE MD harus diawali 0300-'); await expect(tabel).toContainText('Rayon harus R01–R24')
  await expect(tabel.locator('tbody tr')).toHaveCount(4); expect(m.outletMasuk).toHaveLength(0)
})

test('sheet yang dipilih: sheet bernama DMP dibaca walau ada sheet lain berisi data', async ({ page }) => {
  await siap(page)
  const wb = new ExcelJS.Workbook(); const a = wb.addWorksheet('Catatan'); a.addRow(JUDUL); a.addRow(baris({ 'code outlet': 'SALAH' })); const d = wb.addWorksheet('DMP'); d.addRow(JUDUL); d.addRow(baris({ 'code outlet': 'BENAR' }))
  await page.getByLabel('File DMP (.xlsx)').setInputFiles({ name: 'dua-sheet.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from(await wb.xlsx.writeBuffer()) })
  await expect(page.getByText('sheet “DMP”')).toBeVisible(); await expect(page.getByText('1 outlet siap disimpan')).toBeVisible()
})
