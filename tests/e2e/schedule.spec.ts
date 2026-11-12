import { test, expect } from '@playwright/test'
import { buatMock, pasang } from './mock'

// Jadwal rayon per frontliner (halaman admin /schedule) dan layar HP frontliner yang mengikuti jadwal.
test.describe('Schedule (admin)', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('tambah rayon ke sebuah hari: outlet tampil dengan Outlet ID di sebelah nama, lalu urungkan', async ({ page }) => {
    const m = buatMock({ role: 'mdm' }); await pasang(page, m)
    await page.goto('/schedule')
    await expect(page.getByText('0300-TMTB01').first()).toBeVisible()
    await expect(page.getByText(/Hari ini Minggu ke 2 · Rabu/)).toBeVisible()
    await expect(page.getByRole('tab', { name: /Minggu 2/ })).toHaveAttribute('aria-selected', 'true')   // minggu berjalan terbuka lebih dulu
    await page.getByRole('button', { name: 'Tambah rayon untuk Rabu Minggu ke 2' }).click()
    await expect(page.getByRole('dialog', { name: 'Pilih rayon' })).toBeVisible()
    await page.getByRole('button', { name: /^R01, 2 outlet/ }).click()
    await expect.poll(() => m.panggilan('schedule_tambah')[0]?.args).toEqual({ p_frontliner: 'u-fl-1', p_minggu: 2, p_hari: 3, p_rayon: 1 })
    const rabu = page.getByRole('article', { name: 'Rabu, Minggu ke 2' }), rincian = page.getByRole('region', { name: 'Outlet Rabu Minggu ke 2' })
    await expect(rabu.getByText('R01', { exact: true })).toBeVisible()
    await expect(rabu.getByRole('button', { name: /2 outlet/ })).toBeVisible()
    await expect(rincian.getByText('Warung Sumber Rejeki')).toBeVisible(); await expect(rincian.getByText('111222333')).toBeVisible()   // hari yang baru diisi langsung terbuka
    await rincian.getByPlaceholder('Cari nama, ID, atau alamat').fill('4445')   // cari lewat Outlet ID
    await expect(rincian.getByText('Toko Berkah Jaya')).toBeVisible(); await expect(rincian.getByText('Warung Sumber Rejeki')).toHaveCount(0)
    await page.getByRole('button', { name: 'Urungkan' }).click()
    await expect(rabu.getByText('Belum ada rayon')).toBeVisible(); expect(m.jadwal).toEqual([])
  })

  test('rayon yang sudah ada di hari itu dinonaktifkan dan bisa dilepas', async ({ page }) => {
    const m = buatMock({ role: 'mdm' }); m.jadwal.push({ id: 'j1', frontliner_id: 'u-fl-1', minggu: 1, hari: 1, rayon: 2 }); await pasang(page, m)
    await page.goto('/schedule'); await page.getByRole('tab', { name: /Minggu 1/ }).click()
    const senin = page.getByRole('article', { name: 'Senin, Minggu ke 1' })
    await expect(page.getByRole('region', { name: 'Outlet Senin Minggu ke 1' }).getByText('Kios Mawar')).toBeVisible()   // hari terisi pertama terbuka otomatis
    await senin.getByRole('button', { name: 'Tambah rayon untuk Senin Minggu ke 1' }).click()
    await expect(page.getByRole('button', { name: /^R02,.*sudah dijadwalkan di hari ini/ })).toBeDisabled()
    await page.keyboard.press('Escape'); await expect(page.getByRole('dialog', { name: 'Pilih rayon' })).toHaveCount(0)
    await senin.getByRole('button', { name: 'Lepas R02 dari Senin Minggu ke 1' }).click()
    await expect(senin.getByText('Belum ada rayon')).toBeVisible(); expect(m.jadwal).toEqual([])
  })

  test('MDM mengunci jadwal (dengan konfirmasi); MDS tidak melihat saklar kunci', async ({ page }) => {
    const m = buatMock({ role: 'mdm' }); m.jadwal.push({ id: 'j1', frontliner_id: 'u-fl-1', minggu: 2, hari: 3, rayon: 1 }); await pasang(page, m)
    await page.goto('/schedule')
    await page.locator('.sc-prof label.switch').click()   // input saklar disembunyikan, yang diklik adalah slider-nya
    await page.getByRole('button', { name: 'Kunci', exact: true }).click()
    await expect(page.getByText('Jadwal Adin Shandi dikunci.')).toBeVisible()
    await expect.poll(() => m.panggilan('schedule_kunci')[0]?.args).toEqual({ p_frontliner: 'u-fl-1', p_kunci: true })
    await expect(page.getByRole('switch', { name: 'Kunci jadwal' })).toBeChecked()
  })
  test('MDS: saklar kunci tidak ada, hanya keterangan', async ({ page }) => {
    const m = buatMock({ role: 'mds' }); await pasang(page, m)
    await page.goto('/schedule'); await expect(page.getByText('0300-TMTB01').first()).toBeVisible()
    await expect(page.getByRole('switch', { name: 'Kunci jadwal' })).toHaveCount(0)
    await expect(page.getByText('Hanya MDM dan RMDM yang dapat mengunci jadwal')).toBeVisible()
  })

  test('Ringkasan 4 minggu: sel membuka hari itu', async ({ page }) => {
    const m = buatMock({ role: 'mdm' }); m.jadwal.push({ id: 'j1', frontliner_id: 'u-fl-1', minggu: 3, hari: 5, rayon: 2 }, { id: 'j2', frontliner_id: 'u-fl-1', minggu: 1, hari: 2, rayon: 2 }); await pasang(page, m)
    await page.goto('/schedule'); await page.getByRole('tab', { name: /Ringkasan/ }).click()
    await expect(page.getByText(/1 dari 24 rayon terjadwal/)).toBeVisible(); await expect(page.getByText(/dipakai lebih dari sekali: R02/)).toBeVisible()
    await page.getByRole('button', { name: 'Buka Jumat Minggu ke 3, rayon R02' }).click()
    await expect(page.getByRole('tab', { name: /Minggu 3/ })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('region', { name: 'Outlet Jumat Minggu ke 3' }).getByText('Kios Mawar')).toBeVisible()
  })
  test('daftar outlet panjang tampil bertahap, dan pindah frontliner dengan tombol sebelumnya/berikutnya', async ({ page }) => {
    const m = buatMock({ role: 'mdm' })
    for (let i = 10; i < 50; i++) m.outlets.push({ id: i, name: `Warung Massal ${i}`, address: 'Jl. Panjang', lat: -6.2, long: 106.8, kode_md: m.me.user_id, rayon: 1, status: 'AKTIF', ext_id: `9000000${i}` })
    m.jadwal.push({ id: 'j1', frontliner_id: 'u-fl-1', minggu: 2, hari: 3, rayon: 1 }); await pasang(page, m)
    await page.goto('/schedule'); await expect(page.getByText('Menampilkan 30 dari 42 outlet')).toBeVisible()
    await page.getByRole('button', { name: 'Tampilkan lebih banyak' }).click(); await expect(page.getByText('Menampilkan 42 dari 42 outlet')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Frontliner sebelumnya' })).toBeDisabled()
    await page.getByRole('button', { name: 'Frontliner berikutnya' }).click()
    await expect(page.getByRole('region', { name: /^Profil/ }).getByRole('heading')).not.toHaveText('Adin Shandi')
  })
  test('Isi urut mengisi 24 hari R01–R24', async ({ page }) => {
    const m = buatMock({ role: 'mdm' }); await pasang(page, m)
    await page.goto('/schedule'); await page.getByRole('button', { name: /Isi urut/ }).click()
    await page.getByRole('button', { name: 'Isi', exact: true }).click()
    await expect(page.getByText('24 hari diisi')).toBeVisible(); expect(m.jadwal).toHaveLength(24)
  })
})

test.describe('Schedule di layar HP', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  test('tidak ada gulir ke samping dan semua kontrol tetap terjangkau', async ({ page }) => {
    const m = buatMock({ role: 'mdm' }); m.jadwal.push({ id: 'j1', frontliner_id: 'u-fl-1', minggu: 2, hari: 3, rayon: 1 }); await pasang(page, m)
    await page.goto('/schedule'); await expect(page.getByRole('region', { name: 'Outlet Rabu Minggu ke 2' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.getByRole('button', { name: 'Tambah rayon untuk Kamis Minggu ke 2' }).click()
    await expect(page.getByRole('dialog', { name: 'Pilih rayon' })).toBeVisible()
    const kotak = (await page.getByRole('dialog').boundingBox())!; expect(kotak.x).toBeGreaterThanOrEqual(0); expect(kotak.x + kotak.width).toBeLessThanOrEqual(390)
  })
})

test.describe('Layar HP frontliner mengikuti jadwal', () => {
  test('jadwal dikunci: rayon tidak bisa dipilih dan daftar hanya rayon jadwal hari ini', async ({ page }) => {
    const m = buatMock(); m.kunciJadwal = true; m.jadwal.push({ id: 'j1', frontliner_id: 'u-fl-1', minggu: 2, hari: 3, rayon: 2 }); await pasang(page, m)
    await page.goto('/m')
    await expect(page.getByText('Kios Mawar')).toBeVisible()
    await expect(page.getByText('Warung Sumber Rejeki')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Rayon R\d\d/ })).toHaveCount(0)
    await expect(page.getByRole('status', { name: /Rayon dikunci mengikuti jadwal: R02/ })).toBeVisible()
    await expect(page.getByText('Jadwal dikunci · Minggu ke 2 · Rabu')).toBeVisible()
  })
  test('jadwal dikunci tetapi hari ini kosong: pesan jelas, tidak ada outlet', async ({ page }) => {
    const m = buatMock(); m.kunciJadwal = true; await pasang(page, m)
    await page.goto('/m'); await expect(page.getByText('Tidak ada jadwal kunjungan hari ini')).toBeVisible()
    await expect(page.getByText('Warung Sumber Rejeki')).toHaveCount(0)
  })
  test('tidak dikunci: tetap bebas memilih rayon, jadwal hanya petunjuk', async ({ page }) => {
    const m = buatMock(); m.jadwal.push({ id: 'j1', frontliner_id: 'u-fl-1', minggu: 2, hari: 3, rayon: 2 }); await pasang(page, m)
    await page.goto('/m'); await expect(page.getByText('Warung Sumber Rejeki')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Rayon R\d\d/ })).toBeVisible()
    await page.getByRole('button', { name: 'Pakai R02' }).click()
    await expect(page.getByText('Kios Mawar')).toBeVisible()
  })
  test('tanpa migrasi 19 aplikasi tetap berjalan seperti biasa', async ({ page }) => {
    const m = buatMock(); await pasang(page, m)
    await page.route('**/rest/v1/rpc/jadwal_hari_ini', r => r.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function', details: null, hint: null }) }))
    await page.goto('/m'); await expect(page.getByText('Warung Sumber Rejeki')).toBeVisible(); await expect(page.getByRole('button', { name: /^Rayon R\d\d/ })).toBeVisible()
  })
})
