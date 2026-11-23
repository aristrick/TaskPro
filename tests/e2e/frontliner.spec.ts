import { test, expect } from '@playwright/test'
import { buatMock, pasang } from './mock'

test('login dengan User ID dan password lalu masuk ke layar frontliner', async ({ page }) => {
  const m = buatMock(); await pasang(page, m, { masuk: false })
  await page.goto('/login')
  await page.getByLabel('User ID').fill('0300-TMTB01'); await page.getByLabel('Password').fill('salah'); await page.getByRole('button', { name: 'Login' }).click()
  await expect(page.getByText('User ID atau password salah.')).toBeVisible()
  await page.getByLabel('Password').fill('rahasia'); await page.getByRole('button', { name: 'Login' }).click()
  await page.waitForURL('**/m'); await expect(page.getByText('Input Selling')).toBeVisible(); await expect(page.getByText('Warung Sumber Rejeki')).toBeVisible()
  expect(m.panggilan('sesi_klaim')).toHaveLength(1)
})

test('check-in, isi penjualan, check-out: data sampai ke server dan struk ditawarkan', async ({ page }) => {
  const m = buatMock(); await pasang(page, m)
  await page.goto('/m'); await expect(page.getByText('Warung Sumber Rejeki')).toBeVisible()
  await expect(page.getByRole('progressbar', { name: 'Progres kunjungan' })).toHaveText('0/2')

  await page.getByText('Warung Sumber Rejeki').click()
  await page.getByRole('dialog', { name: 'Check-in di outlet ini?' }).getByRole('button', { name: 'Check-in', exact: true }).click()   // dialog konfirmasi selalu muncul
  await expect(page.getByText('Check-in di Warung Sumber Rejeki')).toBeVisible()   // outlet dalam radius: toast dengan tombol Batalkan
  await expect(page.getByText(/Kunjungan berjalan · sejak/)).toBeVisible()
  expect(m.panggilan('checkin')[0].args).toMatchObject({ p_outlet: 1, p_lat: -6.2, p_lng: 106.8 })

  await expect(page.getByText('FOKUS', { exact: true })).toBeVisible()                           // produk fokus project ditandai
  await page.getByRole('button', { name: 'Tambah BONTEH MATCHA' }).click()
  await page.getByRole('button', { name: 'Tambah', exact: true }).click()       // jadi 2 pcs
  await page.getByRole('button', { name: 'Tambah SAYANG LIQUID 20ML' }).click()
  await expect(page.getByText('2 produk · 3 pcs')).toBeVisible()
  await expect(page.locator('.sumtxt b')).toHaveText('Rp 41.500')

  await page.getByRole('button', { name: 'Check-out', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Simpan penjualan & check-out?')
  await page.getByRole('button', { name: 'Simpan & Check-out' }).click()

  await expect(page.getByRole('dialog', { name: 'Cetak struk' })).toBeVisible()
  const ss = m.panggilan('save_sales')[0].args
  expect(ss.p_items).toEqual([{ product_id: 'pr-1', qty: 2 }, { product_id: 'pr-3', qty: 1 }]); expect(ss).toMatchObject({ p_lat: -6.2, p_lng: 106.8 })
  expect(m.panggilan('checkout')).toHaveLength(1); expect(m.aktif()).toBeNull()
  await expect(page.getByLabel('Pratinjau struk')).toContainText('BONTEH MATCHA')
})

test('draf penjualan bertahan setelah halaman dimuat ulang', async ({ page }) => {
  const m = buatMock(); await pasang(page, m)
  await page.goto('/m'); await page.getByText('Toko Berkah Jaya').click(); await page.getByRole('button', { name: 'Check-in' }).click()
  await page.getByRole('button', { name: 'Tambah BONTEH TEH TARIK' }).click()
  await expect(page.getByText('1 produk · 1 pcs')).toBeVisible()
  await page.reload(); await expect(page.getByText(/Kunjungan berjalan · sejak/)).toBeVisible()
  await expect(page.getByText('1 produk · 1 pcs')).toBeVisible()
})

test('salah ketuk check-in: tombol Batalkan menghapus kunjungan dan kembali ke daftar', async ({ page }) => {
  const m = buatMock(); await pasang(page, m)
  await page.goto('/m'); await expect(page.getByText('Warung Sumber Rejeki')).toBeVisible()
  await page.getByRole('button', { name: 'Masuk' }).first().click()
  await page.getByRole('button', { name: 'Check-in', exact: true }).click()
  await expect(page.getByText(/Kunjungan berjalan · sejak/)).toBeVisible()
  await page.getByRole('button', { name: 'Batalkan' }).click()
  await expect.poll(() => m.panggilan('batal_checkin').length).toBe(1); expect(m.aktif()).toBeNull()
  await expect(page.getByRole('progressbar', { name: 'Progres kunjungan' })).toHaveText('0/2')
})

test('dialog check-in menampilkan alamat, kecamatan, kelurahan dengan tombol salin', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const m = buatMock(); await pasang(page, m)
  await page.goto('/m'); await page.getByText('Warung Sumber Rejeki').click()
  const d = page.getByRole('dialog', { name: 'Check-in di outlet ini?' })
  await expect(d).toContainText('Jl. Rawa Kepiting 1'); await expect(d).toContainText('Cakung'); await expect(d).toContainText('Rawa Terate')
  for (const [tombol, isi] of [['Salin nama outlet', 'Warung Sumber Rejeki'], ['Salin alamat', 'Jl. Rawa Kepiting 1'], ['Salin kecamatan', 'Cakung'], ['Salin kelurahan', 'Rawa Terate']]) {
    await d.getByRole('button', { name: tombol }).click()
    await expect(d.getByRole('button', { name: tombol })).toContainText('Tersalin')
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(isi)
  }
  await d.getByRole('button', { name: 'Batal' }).click()
  await expect(d).toBeHidden(); expect(m.panggilan('checkin')).toHaveLength(0)   // batal: belum check-in
})

test('outlet tanpa kecamatan dan kelurahan: tombol salinnya nonaktif', async ({ page }) => {
  await pasang(page, buatMock()); await page.goto('/m'); await page.getByText('Toko Berkah Jaya').click()
  const d = page.getByRole('dialog', { name: 'Check-in di outlet ini?' })
  await expect(d.getByRole('button', { name: 'Salin alamat' })).toBeEnabled()
  await expect(d.getByRole('button', { name: 'Salin kecamatan' })).toBeDisabled(); await expect(d.getByRole('button', { name: 'Salin kelurahan' })).toBeDisabled()
})

test('MDM mematikan cetak: tidak ada tawaran struk dan menu printer hilang dari Profile', async ({ page }) => {
  const m = buatMock(); m.cetakAktif = false; await pasang(page, m)
  await page.goto('/m'); await page.getByText('Warung Sumber Rejeki').click(); await page.getByRole('button', { name: 'Check-in', exact: true }).click()
  await page.getByRole('button', { name: 'Tambah BONTEH MATCHA' }).click()
  await page.getByRole('button', { name: 'Check-out', exact: true }).click(); await page.getByRole('button', { name: 'Simpan & Check-out' }).click()
  await expect(page.getByText('Check-out berhasil')).toBeVisible(); expect(m.panggilan('checkout')).toHaveLength(1)   // penjualan tetap tersimpan
  await expect(page.getByRole('dialog', { name: 'Cetak struk' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Profile' }).click()
  await expect(page.getByText('Printer dan struk')).toHaveCount(0); await expect(page.getByText('Cetak ulang struk terakhir')).toHaveCount(0)
})

test('cetak aktif (bawaan): menu printer dan cetak ulang ada di Profile', async ({ page }) => {
  await pasang(page, buatMock()); await page.goto('/m'); await page.getByRole('button', { name: 'Profile' }).click()
  await expect(page.getByText('Printer dan struk')).toBeVisible(); await expect(page.getByText('Cetak ulang struk terakhir')).toBeVisible()
})
