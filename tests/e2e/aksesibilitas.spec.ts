import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { buatMock, pasang } from './mock'

// Pemeriksaan aksesibilitas otomatis (axe-core, aturan WCAG 2.0/2.1 level A dan AA). Aturannya ketat: nol pelanggaran, apa pun tingkatnya.
// Yang tertangkap: kolom tanpa label, kontras warna kurang, ARIA salah pakai, dan semacamnya. Tidak menggantikan uji manual dengan pembaca layar.
async function periksa(page: Page, nama: string) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const ringkas = r.violations.map(v => `${v.impact} ${v.id}: ${v.help} -> ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`)
  expect(ringkas, `Pelanggaran aksesibilitas di ${nama}`).toEqual([])
}
const HALAMAN_ADMIN = ['/', '/frontliner', '/project', '/outlet', '/import', '/stok', '/report', '/produk', '/pantau', '/cabang', '/mds', '/penjualan']

test.describe('admin (desktop)', () => {
  test.use({ viewport: { width: 1280, height: 800 } })
  test('halaman login', async ({ page }) => { await pasang(page, buatMock({ role: 'mdm' }), { masuk: false }); await page.goto('/login'); await expect(page.getByLabel('User ID')).toBeVisible(); await periksa(page, '/login') })
  for (const u of HALAMAN_ADMIN) test(`halaman ${u}`, async ({ page }) => {
    await pasang(page, buatMock({ role: 'mdm' })); await page.goto(u); await expect(page.locator('.pagehead h2')).toBeVisible(); await page.waitForTimeout(700); await periksa(page, u)
  })
  test('dialog batas check-out (pilihan cepat dan isian)', async ({ page }) => {
    await pasang(page, buatMock({ role: 'mdm' })); await page.goto('/frontliner'); await page.getByRole('button', { name: /Ubah batas check-out Adin/ }).click()
    await expect(page.getByRole('dialog', { name: 'Batas minimal check-out' })).toBeVisible(); await periksa(page, 'dialog batas check-out')
  })
  test('dialog pilihan hapus dan formulir alasan', async ({ page }) => {
    await pasang(page, buatMock({ role: 'mdm' })); await page.goto('/penjualan'); await page.getByRole('button', { name: /Hapus kunjungan Warung/ }).click()
    await expect(page.getByRole('dialog', { name: 'Apa yang ingin dihapus?' })).toBeVisible(); await periksa(page, 'dialog pilih hapus')
    await page.getByRole('button', { name: /Hapus penjualan saja/ }).click(); await expect(page.getByRole('dialog', { name: 'Hapus penjualan ini?' })).toBeVisible(); await periksa(page, 'dialog alasan hapus')
  })
  test('formulir tambah akun dan kolom pencarian bertipe combobox', async ({ page }) => {
    await pasang(page, buatMock({ role: 'mdm' })); await page.goto('/frontliner'); await page.getByRole('button', { name: 'Tambah akun' }).click(); await periksa(page, 'formulir tambah akun')
    await page.goto('/project'); await page.getByRole('combobox', { name: 'Tambah frontliner' }).click(); await expect(page.getByRole('listbox')).toBeVisible(); await periksa(page, 'combobox terbuka')
  })
  test('peringatan sesi akan berakhir', async ({ page }) => {
    await page.clock.install(); await pasang(page, buatMock({ role: 'mdm' })); await page.goto('/project'); await expect(page.getByText('TASKFORCE BONTEH SUNTER')).toBeVisible()
    await page.clock.fastForward('29:30'); await expect(page.getByRole('alertdialog', { name: 'Sesi akan berakhir' })).toBeVisible(); await periksa(page, 'peringatan sesi')
  })
})

test.describe('frontliner (HP)', () => {
  test.use({ viewport: { width: 390, height: 800 } })
  test('daftar outlet, kunjungan berjalan, dan kolom jumlah', async ({ page }) => {
    await pasang(page, buatMock()); await page.goto('/m'); await expect(page.getByText('Warung Sumber Rejeki')).toBeVisible(); await periksa(page, '/m daftar outlet')
    await page.getByText('Warung Sumber Rejeki').click(); await page.getByRole('button', { name: 'Check-in' }).click(); await expect(page.getByText(/Kunjungan berjalan/)).toBeVisible()
    await page.getByRole('button', { name: 'Tambah BONTEH MATCHA' }).click(); await page.waitForTimeout(400); await periksa(page, '/m kunjungan berjalan')
  })
})
