import { test, expect } from '@playwright/test'
import { buatMock, pasang } from './mock'

test.use({ viewport: { width: 1200, height: 800 } })
const PESAN = 'Anda keluar otomatis karena tidak ada aktivitas selama 30 menit. Silakan login lagi.'

test('MDM yang diam: peringatan di menit ke-29, tombol Tetap masuk memperpanjang, lalu keluar otomatis ke halaman login dengan pesan', async ({ page }) => {
  const m = buatMock({ role: 'mdm' }); await page.clock.install(); await pasang(page, m)
  await page.goto('/project'); await expect(page.getByText('TASKFORCE BONTEH SUNTER')).toBeVisible()
  await page.clock.fastForward('29:30')
  const dlg = page.getByRole('alertdialog', { name: 'Sesi akan berakhir' })
  await expect(dlg).toBeVisible(); await expect(dlg).toContainText('Anda akan keluar otomatis dalam 0:30')
  await dlg.getByRole('button', { name: 'Tetap masuk' }).click(); await expect(dlg).toHaveCount(0)       // diperpanjang

  await page.clock.fastForward('29:30'); await expect(dlg).toBeVisible()                                   // hitungan mulai dari nol lagi
  await page.clock.fastForward('01:00')
  await page.waitForURL('**/login'); await expect(page.getByText(PESAN)).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('taskpro-auth'))).toBeNull()                         // sesi benar-benar dihapus
  await page.goto('/project'); await page.waitForURL('**/login')                                           // tidak bisa kembali tanpa login
})

test('beraktivitas (klik dan ketik) menunda logout otomatis', async ({ page }) => {
  const m = buatMock({ role: 'mdm' }); await page.clock.install(); await pasang(page, m)
  await page.goto('/project'); await expect(page.getByText('TASKFORCE BONTEH SUNTER')).toBeVisible()
  for (let i = 0; i < 4; i++) { await page.clock.fastForward('20:00'); await page.getByText('TASKFORCE BONTEH SUNTER').click() }   // total 80 menit, tapi tidak pernah diam 30 menit
  await expect(page.getByRole('alertdialog', { name: 'Sesi akan berakhir' })).toHaveCount(0); expect(new URL(page.url()).pathname).toBe('/project')
})

test('sesi yang tersimpan lalu dibuka lagi setelah lama (laptop dibiarkan) langsung diminta login', async ({ page }) => {
  const m = buatMock({ role: 'mdm' }); await pasang(page, m)
  await page.addInitScript(() => { if (!sessionStorage.getItem('sudah')) { sessionStorage.setItem('sudah', '1'); localStorage.setItem('taskpro-aktif', String(Date.now() - 45 * 60_000)) } })
  await page.goto('/project'); await page.waitForURL('**/login'); await expect(page.getByText(PESAN)).toBeVisible()
})

test('frontliner tidak terkena logout otomatis', async ({ page }) => {
  const m = buatMock(); await page.clock.install(); await pasang(page, m)
  await page.goto('/m'); await expect(page.getByText('Warung Sumber Rejeki')).toBeVisible()
  await page.clock.fastForward('45:00'); await expect(page.getByRole('alertdialog', { name: 'Sesi akan berakhir' })).toHaveCount(0); expect(new URL(page.url()).pathname).toBe('/m')
})
