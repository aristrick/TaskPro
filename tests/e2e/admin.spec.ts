import { test, expect } from '@playwright/test'
import { buatMock, pasang } from './mock'

test.use({ viewport: { width: 1280, height: 800 } })

test.describe('Frontliner: batas check-out dan logout paksa', () => {
  test('batas check-out diubah lewat dialog: pilihan cepat, validasi, ringkasan, dan Urungkan', async ({ page }) => {
    const m = buatMock({ role: 'mdm' }); await pasang(page, m); await page.goto('/frontliner')
    const tombol = page.getByRole('button', { name: 'Ubah batas check-out Adin Shandi, sekarang 5 menit' })
    await expect(tombol).toBeVisible(); await expect(page.getByRole('button', { name: /Ubah batas check-out Budi Santoso, sekarang Tanpa batas/ })).toBeVisible()
    await expect(page.locator('input[aria-label^="Batas minimal"]')).toHaveCount(0)                    // tidak ada lagi kolom isian terbuka di tabel

    await tombol.click(); const dlg = page.getByRole('dialog', { name: 'Batas minimal check-out' })
    await expect(dlg).toContainText('baru bisa check-out 5 menit setelah check-in'); await expect(dlg).toContainText('Saat ini: 5 menit')
    await dlg.getByRole('button', { name: '15 menit' }).click(); await expect(dlg).toContainText('baru bisa check-out 15 menit'); await expect(dlg.getByRole('textbox')).toHaveValue('15')
    await dlg.getByRole('textbox').fill('200'); await dlg.getByRole('button', { name: 'Simpan batas' }).click()
    await expect(dlg.getByRole('alert')).toHaveText('Isi bilangan bulat 0 sampai 120.'); expect(m.akunPanggilan).toHaveLength(0)       // tidak tersimpan, dialog tetap terbuka
    await dlg.getByRole('textbox').fill('10'); await dlg.getByRole('button', { name: 'Simpan batas' }).click()
    await expect.poll(() => m.akunPanggilan[0]).toEqual({ method: 'PATCH', body: { id: 'u-fl-1', min_checkout_menit: 10 } })
    await expect(page.getByText('Batas check-out Adin Shandi menjadi 10 menit.')).toBeVisible()
    await expect(page.getByRole('button', { name: /Ubah batas check-out Adin Shandi, sekarang 10 menit/ })).toBeVisible()
    await page.getByRole('button', { name: 'Urungkan' }).click()
    await expect(page.getByRole('button', { name: /Ubah batas check-out Adin Shandi, sekarang 5 menit/ })).toBeVisible(); await expect.poll(() => m.akunPanggilan[1]?.body).toEqual({ id: 'u-fl-1', min_checkout_menit: 5 })
  })

  test('Batal dan 0 menit: Batal tidak mengubah apa pun, 0 berarti tanpa batas', async ({ page }) => {
    const m = buatMock({ role: 'mdm' }); await pasang(page, m); await page.goto('/frontliner')
    const dlg = page.getByRole('dialog', { name: 'Batas minimal check-out' })
    await page.getByRole('button', { name: /Ubah batas check-out Adin Shandi/ }).click(); await dlg.getByRole('button', { name: 'Batal' }).click(); await expect(dlg).toHaveCount(0); expect(m.akunPanggilan).toHaveLength(0)
    await page.getByRole('button', { name: /Ubah batas check-out Adin Shandi/ }).click(); await dlg.getByRole('button', { name: 'Tanpa batas', exact: true }).click(); await dlg.getByRole('button', { name: 'Simpan batas' }).click()
    await expect.poll(() => m.akunPanggilan.length).toBe(1); expect(m.akunPanggilan[0].body).toEqual({ id: 'u-fl-1', min_checkout_menit: 0 }); await expect(page.getByText('Batas check-out Adin Shandi menjadi Tanpa batas.')).toBeVisible()
  })

  test('tata letak tabel stabil: tombol aksi di posisi yang sama dan tinggi baris sama, aktif maupun tidak', async ({ page }) => {
    const m = buatMock({ role: 'mdm' }); await pasang(page, m); await page.goto('/frontliner'); await expect(page.getByText('Adin Shandi').first()).toBeVisible()
    const baris = page.locator('table.tfl tbody tr'); await expect(baris).toHaveCount(3)
    const geo = async () => Promise.all([0, 1, 2].map(async i => { const r = baris.nth(i); const [b, e] = await Promise.all([r.boundingBox(), r.getByRole('button', { name: 'Edit', exact: true }).boundingBox()]); return { h: Math.round(b!.height), editX: e ? Math.round(e.x) : null } }))
    const sebelum = await geo()
    expect(new Set(sebelum.map(x => x.h)).size).toBe(1); expect(new Set(sebelum.slice(1).map(x => x.editX)).size).toBe(1)           // baris frontliner: Edit sejajar
    await expect(baris.nth(1).getByRole('button', { name: /Logout paksa/ })).toBeEnabled(); await expect(baris.nth(2).getByRole('button', { name: /Logout paksa/ })).toBeDisabled()
    m.aktifIds = ['u-fl-1', 'u-fl-2']; await page.reload(); await expect(baris.nth(2).getByRole('button', { name: /Logout paksa/ })).toBeEnabled()
    const sesudah = await geo(); expect(sesudah.map(x => x.h)).toEqual(sebelum.map(x => x.h)); expect(sesudah.map(x => x.editX)).toEqual(sebelum.map(x => x.editX))   // status berubah, tata letak tidak bergeser
  })

  test('logout paksa meminta konfirmasi lalu memanggil API sesi', async ({ page }) => {
    const m = buatMock({ role: 'mdm' }); await pasang(page, m); await page.goto('/frontliner')
    await page.locator('table.tfl tbody tr').nth(1).getByRole('button', { name: /Logout paksa/ }).click()
    await expect(page.getByRole('alertdialog')).toContainText('akan dikeluarkan dari perangkatnya'); await page.getByRole('button', { name: 'Logout paksa' }).last().click()
    await expect.poll(() => m.sesiPanggilan).toEqual([{ id: 'u-fl-1' }]); await expect(page.locator('table.tfl tbody tr').nth(1).getByText('Tidak aktif')).toBeVisible()
  })

  test('formulir tambah akun tersembunyi sampai dibutuhkan, berlabel, dan tertutup lagi saat Batal', async ({ page }) => {
    const m = buatMock({ role: 'mdm' }); await pasang(page, m); await page.goto('/frontliner')
    await expect(page.getByLabel('User ID')).toHaveCount(0); await page.getByRole('button', { name: 'Tambah akun' }).click()
    for (const l of ['Role', 'User ID', 'Nama', 'Password sementara', 'Atasan']) await expect(page.getByLabel(l, { exact: false }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Batal' }).click(); await expect(page.getByLabel('User ID')).toHaveCount(0)
  })
})

test.describe('Edit Penjualan: hapus penjualan (khusus MDM)', () => {
  test('MDM menghapus penjualan satu kunjungan dengan alasan; kunjungan tetap ada tanpa penjualan', async ({ page }) => {
    const m = buatMock({ role: 'mdm' }); await pasang(page, m); await page.goto('/penjualan')
    await expect(page.getByText('2 produk · 3 pcs')).toBeVisible(); await expect(page.getByText('tanpa penjualan')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Hapus penjualan Toko Berkah Jaya' })).toBeDisabled()          // tanpa penjualan: tidak ada yang dihapus
    await page.getByRole('button', { name: 'Hapus penjualan Warung Sumber Rejeki' }).click()
    const dlg = page.getByRole('dialog', { name: 'Hapus penjualan ini?' }); await expect(dlg).toContainText('2 produk, 3 pcs'); await expect(dlg).toContainText('Rp 41.500')
    await dlg.getByRole('button', { name: 'Hapus penjualan' }).click(); await expect(dlg.getByRole('alert')).toHaveText('Alasan wajib diisi (minimal 3 huruf).'); expect(m.panggilan('penjualan_hapus')).toHaveLength(0)
    await dlg.getByRole('textbox').fill('salah input'); await dlg.getByRole('button', { name: 'Hapus penjualan' }).click()
    await expect.poll(() => m.panggilan('penjualan_hapus')[0]?.args).toEqual({ p_visit: 'v-1', p_alasan: 'salah input' })
    await expect(page.getByRole('dialog', { name: 'Penjualan dihapus' })).toBeVisible(); await page.getByRole('button', { name: 'Mengerti' }).click()
    await expect(page.getByText('tanpa penjualan')).toHaveCount(2); await expect(page.getByText('Warung Sumber Rejeki')).toBeVisible()      // kunjungan masih tampil
  })

  test('penolakan server ditampilkan apa adanya dan data tidak berubah', async ({ page }) => {
    const m = buatMock({ role: 'mdm' }); m.tolakHapus = 'Hanya MDM.'; await pasang(page, m); await page.goto('/penjualan')
    await page.getByRole('button', { name: 'Hapus penjualan Warung Sumber Rejeki' }).click(); const dl = page.getByRole('dialog', { name: 'Hapus penjualan ini?' }); await dl.getByRole('textbox').fill('uji penolakan'); await dl.getByRole('button', { name: 'Hapus penjualan' }).click()
    await expect(page.getByRole('dialog', { name: 'Gagal menghapus penjualan' })).toContainText('Hanya MDM.'); await page.getByRole('button', { name: 'Mengerti' }).click()
    await expect(page.getByText('2 produk · 3 pcs')).toBeVisible()
  })

  test('halaman ini tidak tersedia untuk RMDM', async ({ page }) => {
    const m = buatMock({ role: 'rmdm' }); await pasang(page, m); await page.goto('/penjualan')
    await expect(page.getByText('Halaman ini tidak tersedia untuk role rmdm.')).toBeVisible(); await expect(page.getByRole('button', { name: /Hapus penjualan/ })).toHaveCount(0)
  })
})

test('keseragaman: semua halaman admin memakai kepala yang sama (judul + penjelasan) dan tidak ada error skrip', async ({ page }) => {
  const m = buatMock({ role: 'mdm' }); await pasang(page, m); const galat: string[] = []
  page.on('pageerror', e => galat.push(String(e).slice(0, 160)))
  const halaman: [string, string][] = [['/', 'Home'], ['/frontliner', 'Frontliner'], ['/project', 'Project'], ['/outlet', 'Outlet'], ['/import', 'Import DMP'], ['/stok', 'Stok Pembawaan'], ['/report', 'Report'], ['/produk', 'Produk'], ['/pantau', 'Pantau'], ['/cabang', 'Cabang'], ['/mds', 'MDS & RMDM'], ['/penjualan', 'Edit Penjualan']]
  for (const [path, judul] of halaman) {
    await page.goto(path)
    await expect(page.locator('.pagehead h2'), path).toHaveText(judul); await expect(page.locator('.pagehead .pgdesc'), path).toBeVisible()
    await expect(page.locator('.pagehead')).toHaveCount(1)
  }
  expect(galat).toEqual([])
})
