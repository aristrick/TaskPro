import { test, expect } from '@playwright/test'
import { buatMock, pasang } from './mock'

// Jumlah penjualan bisa diketik bebas: "20", "02", dikosongkan lalu diketik ulang, tanpa harus diawali angka 1.
test('mengetik jumlah manual: 20, 02, kosong lalu ulang, nol, dan batas stok', async ({ page }) => {
  const m = buatMock(); m.stokDibawa = 50; await page.addInitScript(() => localStorage.setItem('taskpro-printer', JSON.stringify({ tanya: false }))); await pasang(page, m)
  await page.goto('/m'); await page.getByText('Warung Sumber Rejeki').click(); await page.getByRole('button', { name: 'Check-in' }).click()
  await page.getByRole('button', { name: 'Tambah BONTEH MATCHA' }).click()
  const inp = page.getByLabel('Jumlah BONTEH MATCHA')

  await inp.click(); await inp.press('Control+a'); await inp.pressSequentially('20')                     // dulu: harus diawali 1
  await expect(inp).toHaveValue('20'); await expect(page.getByText('1 produk · 20 pcs')).toBeVisible(); await expect(page.locator('.sumtxt b')).toHaveText('Rp 390.000')

  await inp.press('Control+a'); await inp.press('Backspace'); await expect(inp).toHaveValue('')           // boleh kosong sementara, tidak melompat ke 1
  await expect(page.getByText('1 produk · 20 pcs')).toBeVisible()                                        // jumlah tersimpan belum berubah
  await inp.pressSequentially('02'); await expect(inp).toHaveValue('02'); await expect(page.getByText('1 produk · 2 pcs')).toBeVisible()
  await inp.press('Tab'); await expect(inp).toHaveValue('2')                                             // dirapikan saat selesai

  await inp.click(); await inp.press('Control+a'); await inp.press('Backspace'); await inp.press('Tab')   // dikosongkan lalu ditinggalkan: kembali ke jumlah sebelumnya
  await expect(inp).toHaveValue('2')

  await inp.click(); await inp.press('Control+a'); await inp.pressSequentially('0')                       // nol: baris tidak hilang saat masih mengetik
  await expect(inp).toBeVisible(); await expect(page.getByText('Belum ada penjualan')).toBeVisible()
  await inp.pressSequentially('5'); await expect(inp).toHaveValue('05'); await expect(page.getByText('1 produk · 5 pcs')).toBeVisible()
  await inp.press('Control+a'); await inp.pressSequentially('0'); await inp.press('Tab')                  // nol lalu selesai: produk dilepas
  await expect(page.getByRole('button', { name: 'Tambah BONTEH MATCHA' })).toBeVisible()

  await page.getByRole('button', { name: 'Tambah BONTEH MATCHA' }).click(); await inp.click(); await inp.press('Control+a'); await inp.pressSequentially('99')
  await expect(inp).toHaveValue('50'); await expect(page.getByText('1 produk · 50 pcs')).toBeVisible()      // dibatasi sisa stok
})

test('jumlah yang diketik ikut terkirim ke server saat check-out', async ({ page }) => {
  const m = buatMock(); m.stokDibawa = 50; await page.addInitScript(() => localStorage.setItem('taskpro-printer', JSON.stringify({ tanya: false }))); await pasang(page, m)
  await page.goto('/m'); await page.getByText('Warung Sumber Rejeki').click(); await page.getByRole('button', { name: 'Check-in' }).click()
  await page.getByRole('button', { name: 'Tambah SAYANG LIQUID 20ML' }).click(); const inp = page.getByLabel('Jumlah SAYANG LIQUID 20ML')
  await inp.click(); await inp.press('Control+a'); await inp.pressSequentially('012'); await inp.press('Tab')
  await page.getByRole('button', { name: 'Check-out', exact: true }).click(); await page.getByRole('button', { name: 'Simpan & Check-out' }).click()
  await expect.poll(() => m.panggilan('save_sales')[0]?.args.p_items).toEqual([{ product_id: 'pr-3', qty: 12 }])
})
