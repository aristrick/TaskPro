// Membuat file Excel format contoh DMP: sheet DMP (kosong, untuk diisi), CONTOH (pola pengisian), dan PETUNJUK (aturan tiap kolom).
// Nama kolom diambil dari KOLOM_DMP, sumber yang sama dengan pemeriksaan format, jadi file contoh selalu lolos pemeriksaan.
import type { Cell, Worksheet } from 'exceljs'
import { KOLOM_DMP } from './dmp'

// Definisi tipe ExcelJS belum memuat dataValidations walau fiturnya ada saat dijalankan (diuji di tests/unit/dmp-format.test.ts)
type DenganValidasi = { dataValidations: { add: (rentang: string, aturan: Record<string, unknown>) => void } }
const BARIS_VALIDASI = 1500            // jumlah baris yang diberi dropdown/batas isian (lebih banyak = berkas membengkak)
const NAVY = 'FF0B1F4B', ABU = 'FFE6EAF2', KUNING = 'FFFFF4D6'

export async function buatTemplateDmp(kode: string): Promise<ArrayBuffer> {
  const mod = await import('exceljs'), ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod
  const wb = new ExcelJS.Workbook(); wb.creator = 'TaskPro'
  const nomor = (nama: string) => KOLOM_DMP.findIndex(k => k.nama === nama) + 1
  const huruf = (nama: string) => String.fromCharCode(64 + nomor(nama))     // 15 kolom: cukup A..O
  const judul = (ws: Worksheet) => {
    const r = ws.addRow(KOLOM_DMP.map(k => k.judul)); r.height = 24
    KOLOM_DMP.forEach((k, i) => {
      const c = r.getCell(i + 1)
      c.font = { bold: true, color: { argb: k.wajib ? 'FFFFFFFF' : 'FF12274D' } }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: k.wajib ? NAVY : ABU } }
      c.alignment = { vertical: 'middle' }; c.note = `${k.wajib ? 'WAJIB' : 'Opsional'}: ${k.ket}`
      ws.getColumn(i + 1).width = Math.max(14, Math.min(34, k.judul.length + 6, 34))
      if (!['latitude', 'longitude'].includes(k.nama)) ws.getColumn(i + 1).numFmt = '@'   // teks: angka nol di depan ID/kode tidak hilang
    })
    ws.getColumn(nomor('full_address')).width = 38; ws.getColumn(nomor('name')).width = 28
  }

  const dmp = wb.addWorksheet('DMP', { views: [{ state: 'frozen', ySplit: 1 }] }); judul(dmp)
  const validasi = (dmp as unknown as DenganValidasi).dataValidations
  const akhir = BARIS_VALIDASI + 1, rentang = (nama: string) => `${huruf(nama)}2:${huruf(nama)}${akhir}`
  validasi.add(rentang('rayon'), { type: 'list', allowBlank: true, formulae: [`"${Array.from({ length: 24 }, (_, i) => 'R' + String(i + 1).padStart(2, '0')).join(',')}"`], showErrorMessage: true, errorTitle: 'RAYON', error: 'Isi R01 sampai R24.' })
  validasi.add(rentang('status'), { type: 'list', allowBlank: true, formulae: ['"AKTIF,INAKTIF"'], showErrorMessage: true, errorTitle: 'STATUS', error: 'Isi AKTIF atau INAKTIF (atau kosongkan).' })
  validasi.add(rentang('latitude'), { type: 'decimal', operator: 'between', allowBlank: true, formulae: [-90, 90], showErrorMessage: true, errorTitle: 'latitude', error: 'Isi angka antara -90 dan 90, memakai titik desimal.' })
  validasi.add(rentang('longitude'), { type: 'decimal', operator: 'between', allowBlank: true, formulae: [-180, 180], showErrorMessage: true, errorTitle: 'longitude', error: 'Isi angka antara -180 dan 180, memakai titik desimal.' })
  const km = huruf('kode md')
  validasi.add(rentang('kode md'), { type: 'custom', allowBlank: true, formulae: [`LEFT(${km}2,${kode.length + 1})="${kode}-"`], showErrorMessage: true, errorTitle: 'KODE MD', error: `KODE MD harus diawali ${kode}-` })

  const contoh = wb.addWorksheet('CONTOH', { views: [{ state: 'frozen', ySplit: 1 }] }); judul(contoh)
  const isi = (o: Record<string, string>) => KOLOM_DMP.map(k => o[k.nama] ?? '')
  const dasar = { category: 'General Trade', account: 'Retail', province: 'DKI Jakarta', city: 'Jakarta Timur', 'district / kecamatan': 'Cakung', 'profile outlet': 'Warung', cycle: 'C1', status: 'AKTIF' }
  const baris = [
    isi({ ...dasar, 'code outlet': 'CONTOH-001', name: 'Warung Contoh 1', full_address: 'Jl. Contoh No. 1, Cakung', latitude: '-6.2088', longitude: '106.8456', 'kode md': `${kode}-TMTB01`, rayon: 'R01' }),
    isi({ ...dasar, 'code outlet': 'CONTOH-002', name: 'Toko Contoh 2', full_address: 'Jl. Contoh No. 2, Cakung', latitude: '-6.2150', longitude: '106.8500', 'kode md': `${kode}-TMTB01`, rayon: 'R02' }),
    isi({ ...dasar, 'code outlet': 'CONTOH-003', name: 'Kios Contoh 3 (belum ada koordinat)', full_address: 'Jl. Contoh No. 3, Cakung', 'kode md': `${kode}-TMTB02`, rayon: 'R01', status: '' }),
  ]
  baris.forEach(b => { const r = contoh.addRow(b); r.eachCell((c: Cell) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: KUNING } } }) })
  contoh.addRow([]); const cat = contoh.addRow(['Ini hanya contoh pola pengisian. Salin polanya ke sheet DMP dan ganti dengan data asli. Baris dengan ID diawali "CONTOH" akan ditolak saat diunggah.'])
  cat.getCell(1).font = { italic: true, color: { argb: 'FF7A4B00' } }

  const pet = wb.addWorksheet('PETUNJUK'); pet.getColumn(1).width = 24; pet.getColumn(2).width = 10; pet.getColumn(3).width = 78; pet.getColumn(4).width = 32
  pet.addRow(['Petunjuk pengisian DMP']).getCell(1).font = { bold: true, size: 16, color: { argb: NAVY } }; pet.addRow([])
  const aturan = [
    'Isi data di sheet DMP mulai baris 2. Satu baris = satu outlet.',
    'Jangan mengubah, menghapus, atau menambah spasi pada nama kolom di baris 1. Kolom berlatar biru WAJIB ada. Kolom berlatar abu-abu boleh dikosongkan atau dihapus.',
    `KODE MD harus diawali kode cabang tujuan, yaitu ${kode}- (contoh ${kode}-TMTB01).`,
    'Koordinat memakai titik desimal, bukan koma (contoh -6.2088). Latitude dan longitude diisi keduanya atau dikosongkan keduanya.',
    'ID outlet (code outlet) harus unik. Outlet yang ID-nya sudah ada di database dilewati, jadi mengunggah file yang sama dua kali aman.',
    'Baris kosong dilewati. Sheet CONTOH dan PETUNJUK tidak dibaca saat diunggah.',
    'Simpan sebagai Excel Workbook (.xlsx), ukuran maksimal 10 MB. File .xls atau .csv tidak diterima.',
  ]
  aturan.forEach((a, i) => { const r = pet.addRow([`${i + 1}. ${a}`]); pet.mergeCells(`A${r.number}:D${r.number}`); r.getCell(1).alignment = { wrapText: true, vertical: 'top' }; r.height = a.length > 110 ? 32 : 18 })
  pet.addRow([])
  const h = pet.addRow(['Kolom', 'Wajib', 'Keterangan', 'Contoh isi']); h.eachCell((c: Cell) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } } })
  KOLOM_DMP.forEach(k => { const r = pet.addRow([k.judul, k.wajib ? 'Ya' : 'Tidak', k.ket, k.contoh]); r.getCell(3).alignment = { wrapText: true, vertical: 'top' }; r.getCell(2).alignment = { horizontal: 'center', vertical: 'top' }; r.getCell(1).alignment = { vertical: 'top' }; r.getCell(4).alignment = { vertical: 'top' }; if (k.ket.length > 75) r.height = 32 })
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}
