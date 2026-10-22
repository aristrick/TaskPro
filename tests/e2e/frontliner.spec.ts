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
  await expect(page.getByText('0 dari 2 outlet sudah dikunjungi hari ini')).toBeVisible()

  await page.getByText('Warung Sumber Rejeki').click()
  await expect(page.getByRole('alertdialog')).toContainText('Check-in di outlet ini?'); await page.getByRole('button', { name: 'Check-in' }).click()
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
