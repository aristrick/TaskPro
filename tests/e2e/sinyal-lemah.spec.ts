import { test, expect, type Page } from '@playwright/test'
import { buatMock, pasang, type Mock } from './mock'

// Skenario lapangan: sinyal hilang saat frontliner sedang berkunjung. Struk dimatikan agar dialog cetak tidak menghalangi.
async function siap(page: Page, m: Mock) {
  await page.addInitScript(() => localStorage.setItem('taskpro-printer', JSON.stringify({ tanya: false })))
  await pasang(page, m)
}
async function mulaiKunjungan(page: Page, outlet = 'Warung Sumber Rejeki') {
  await page.goto('/m'); await page.getByText(outlet).click(); await page.getByRole('button', { name: 'Check-in' }).click()
  await expect(page.getByText(/Kunjungan berjalan · sejak/)).toBeVisible()
  await page.getByRole('button', { name: 'Tambah BONTEH MATCHA' }).click(); await page.getByRole('button', { name: 'Tambah SAYANG LIQUID 20ML' }).click()
  await expect(page.getByText('2 produk · 2 pcs')).toBeVisible()
}
async function checkoutOffline(page: Page, m: Mock) {
  m.online = false
  await page.getByRole('button', { name: 'Check-out', exact: true }).click(); await page.getByRole('button', { name: 'Simpan & Check-out' }).click()
  await expect(page.getByText('Tersimpan di HP. Dikirim otomatis saat sinyal kembali')).toBeVisible()
}
const sinyalKembali = (page: Page, m: Mock) => { m.online = true; return page.evaluate(() => window.dispatchEvent(new Event('online'))) }

test('check-out tanpa sinyal disimpan di HP lalu terkirim otomatis dengan waktu asli', async ({ page }) => {
  const m = buatMock(); await siap(page, m); await mulaiKunjungan(page)
  const sebelum = Date.now()
  await checkoutOffline(page, m)
  await expect(page.getByText('1 kunjungan menunggu dikirim.')).toBeVisible()
  expect(m.aktif()).not.toBeNull(); expect(m.panggilan('save_sales')).toHaveLength(0)       // belum ada yang sampai ke server

  await sinyalKembali(page, m)
  await expect(page.getByText('Check-out terkirim')).toBeVisible(); await expect(page.getByText('kunjungan menunggu dikirim')).toHaveCount(0)
  expect(m.aktif()).toBeNull()
  expect(m.panggilan('save_sales')[0].args.p_items).toEqual([{ product_id: 'pr-1', qty: 1 }, { product_id: 'pr-3', qty: 1 }])
  const at = new Date(m.panggilan('checkout_tertunda')[0].args.p_at).getTime()
  expect(at).toBeGreaterThanOrEqual(sebelum - 1000); expect(at).toBeLessThan(Date.now())       // waktu saat tombol ditekan, bukan saat terkirim
  expect(m.panggilan('checkout')).toHaveLength(0)
})

test('check-in berikutnya ditahan sampai antrean terkirim, lalu jalan', async ({ page }) => {
  const m = buatMock(); await siap(page, m); await mulaiKunjungan(page); await checkoutOffline(page, m)
  await page.getByText('Toko Berkah Jaya').click(); await page.getByRole('button', { name: 'Check-in' }).click()
  await expect(page.getByText('Masih ada kunjungan yang menunggu dikirim.')).toBeVisible()
  expect(m.panggilan('checkin')).toHaveLength(1)                                                 // hanya check-in pertama yang pernah sampai
  m.online = true
  await page.getByText('Toko Berkah Jaya').click(); await page.getByRole('button', { name: 'Check-in' }).click()
  await expect(page.getByText(/Kunjungan berjalan · sejak/)).toBeVisible(); expect(m.panggilan('checkin')).toHaveLength(2); expect(m.kunjungan[0].checkout_at).not.toBeNull()
})

test('server menolak penjualan tertunda: pengguna diberi tahu dan isian dipulihkan untuk diperbaiki', async ({ page }) => {
  const m = buatMock(); await siap(page, m); await mulaiKunjungan(page); await checkoutOffline(page, m)
  m.tolakSaveSales = 'Stok BONTEH MATCHA tidak cukup. Sisa 0 pcs, diminta 1 pcs.'
  await sinyalKembali(page, m)
  await expect(page.getByRole('dialog')).toContainText('Penjualan belum bisa dikirim'); await expect(page.getByRole('dialog')).toContainText('Stok BONTEH MATCHA tidak cukup')
  await page.getByRole('button', { name: 'Mengerti' }).click()
  await expect(page.getByText(/Kunjungan berjalan · sejak/)).toBeVisible(); await expect(page.getByText('2 produk · 2 pcs')).toBeVisible()   // isian pulih
  expect(m.aktif()).not.toBeNull()
})

test('aplikasi dibuka ulang tanpa sinyal: kunjungan terakhir tampil dan check-out tetap bisa diantrekan', async ({ page }) => {
  const m = buatMock(); await siap(page, m); await mulaiKunjungan(page)
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('taskpro-snap-')))).toBe(true)
  m.online = false; await page.reload()
  await expect(page.getByText(/Mode offline/)).toBeVisible({ timeout: 20000 }); await expect(page.getByText(/Kunjungan berjalan · sejak/)).toBeVisible()
  await expect(page.getByText('2 produk · 2 pcs')).toBeVisible()
  await page.getByRole('button', { name: 'Check-out', exact: true }).click(); await page.getByRole('button', { name: 'Simpan & Check-out' }).click()
  await expect(page.getByText('Tersimpan di HP. Dikirim otomatis saat sinyal kembali')).toBeVisible()
  await sinyalKembali(page, m); await expect(page.getByText('Check-out terkirim')).toBeVisible({ timeout: 15000 }); expect(m.aktif()).toBeNull()
})

test('service worker: kerangka aplikasi tersimpan sehingga /m terbuka walau seluruh jaringan mati', async ({ page, context }) => {
  const m = buatMock(); await siap(page, m)
  await page.goto('/m'); await page.evaluate(() => navigator.serviceWorker.ready); await page.reload()   // muat kedua sudah dikendalikan service worker
  await page.getByText('Warung Sumber Rejeki').click(); await page.getByRole('button', { name: 'Check-in' }).click()
  await expect(page.getByText(/Kunjungan berjalan · sejak/)).toBeVisible()
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('taskpro-snap-')))).toBe(true)
  m.online = false; await context.setOffline(true); await page.reload()   // jaringan aplikasi DAN Supabase sama-sama mati
  await expect(page.getByText(/Kunjungan berjalan · sejak/)).toBeVisible({ timeout: 20000 }); await expect(page.getByText(/Mode offline/)).toBeVisible()
})
