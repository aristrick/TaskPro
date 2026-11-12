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

// Daftar pilihan produk fokus sebelumnya terpotong tepi kartu project (overflow:hidden) sehingga item bawah tak terjangkau.
test('Project: daftar pilihan produk tidak terpotong kartu dan bisa dipilih sampai item terakhir', async ({ page }) => {
  const m = buatMock({ role: 'mdm' })
  for (let i = 4; i <= 30; i++) m.produk.push({ id: `pr-${i}`, product: `PRODUK TES ${String(i).padStart(2, '0')}`, brand: 'Tes', price: 1000, active: true })
  await pasang(page, m)
  await page.setViewportSize({ width: 1200, height: 600 })
  await page.goto('/project'); await expect(page.getByText('1 frontliner · 1 produk fokus')).toBeVisible()
  const cb = page.getByRole('combobox', { name: 'Tambah produk fokus' }); await cb.scrollIntoViewIfNeeded(); await cb.click()
  const daftar = page.getByRole('listbox', { name: 'Tambah produk fokus' }); await expect(daftar).toBeVisible()
  const kotak = (await daftar.boundingBox())!, vh = page.viewportSize()!.height
  expect(kotak.y).toBeGreaterThanOrEqual(0); expect(kotak.y + kotak.height).toBeLessThanOrEqual(vh)       // seluruh daftar ada di layar
  // titik tengah daftar benar-benar milik daftar (bukan tertutup/terpotong kartu)
  const milikDaftar = await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('[role="listbox"]'), { x: kotak.x + kotak.width / 2, y: kotak.y + kotak.height - 20 })
  expect(milikDaftar).toBe(true)
  await daftar.evaluate(el => { el.scrollTop = el.scrollHeight })                                         // menggulir sampai item terakhir
  await expect(page.getByRole('option', { name: 'PRODUK TES 30' })).toBeInViewport()
  await page.getByRole('option', { name: 'PRODUK TES 30' }).click()
  await expect(page.getByText('PRODUK TES 30 ditambahkan', { exact: false }).or(page.getByText('2 produk fokus'))).toBeVisible()
  expect(m.fokus).toContain('pr-30')
})
