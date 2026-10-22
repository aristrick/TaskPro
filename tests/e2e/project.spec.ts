import { test, expect } from '@playwright/test'
import { buatMock, pasang } from './mock'

test.use({ viewport: { width: 1200, height: 800 } })

test('Project: cari frontliner dengan mengetik, tambahkan, lalu urungkan', async ({ page }) => {
  const m = buatMock({ role: 'mdm' }); await pasang(page, m)
  await page.goto('/project')
  await expect(page.getByText('TASKFORCE BONTEH SUNTER')).toBeVisible(); await expect(page.getByText('1 frontliner · 1 produk fokus')).toBeVisible()
  const cb = page.getByRole('combobox', { name: 'Tambah frontliner' })
  await cb.click(); await expect(page.getByRole('option')).toHaveCount(2)             // Budi dan Sari (Adin sudah di project ini)
  await cb.fill('budi'); await expect(page.getByRole('option')).toHaveCount(1)
  await cb.press('ArrowDown'); await cb.press('Enter')                                 // bisa dipilih lewat papan ketik
  await expect(page.getByText('Budi Santoso dimasukkan ke TASKFORCE BONTEH SUNTER.')).toBeVisible()
  expect(m.panggilan('project_set_member')[0].args).toEqual({ p_frontliner: 'u-fl-2', p_project: 'proj-1' }); await expect(page.getByText('2 frontliner · 1 produk fokus')).toBeVisible()
  await page.getByRole('button', { name: 'Urungkan' }).click()
  await expect(page.getByText('1 frontliner · 1 produk fokus')).toBeVisible()
  expect(m.panggilan('project_set_member')[1].args).toEqual({ p_frontliner: 'u-fl-2', p_project: null })
})

test('Project: melepas produk fokus memberi tombol Urungkan dan memulihkannya', async ({ page }) => {
  const m = buatMock({ role: 'mdm' }); await pasang(page, m)
  await page.goto('/project'); await expect(page.getByText('1 frontliner · 1 produk fokus')).toBeVisible()
  await page.getByRole('button', { name: 'Lepas BONTEH MATCHA dari fokus' }).click()
  await expect(page.getByText('BONTEH MATCHA dilepas dari fokus TASKFORCE BONTEH SUNTER.')).toBeVisible(); expect(m.fokus).toEqual([])
  await expect(page.getByText('Belum ada produk fokus.')).toBeVisible()
  await page.getByRole('button', { name: 'Urungkan' }).click()
  await expect(page.getByText('1 frontliner · 1 produk fokus')).toBeVisible(); expect(m.fokus).toEqual(['pr-1'])
})
