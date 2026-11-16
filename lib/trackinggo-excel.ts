// Ekspor Excel untuk Tracking Go. Tata letak Report Back Tracking dicocokkan dengan format asli "REPORT BACK TRACKING SALES";
// OTJ mendekati template resmi (Section A dan C satu kolom jawaban, Section B satu kolom per toko).
// Fungsi di sini hanya MENYUSUN file (mengembalikan ArrayBuffer); mengunduhnya memakai unduhBuffer dari lib/excel.
import type { Borders, Cell, Fill, Font, Worksheet } from 'exceljs'
import { INDIKATOR, KETENTUAN, TEMUAN_PETUNJUK, type Indikator, type KunciIndikator } from './trackinggo'
import { butirBagian, skorButir, skorPersen, type Butir, type JawabanMap, type Template, type TipeOtj } from './otj-template'

type Lib = typeof import('exceljs')
async function lib(): Promise<Lib> { const m = (await import('exceljs')) as unknown as Lib & { default?: Lib }; return m.default ?? m }

const isi = (argb: string): Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })
const tipis = { style: 'thin' as const, color: { argb: 'FF000000' } }
const GARIS: Partial<Borders> = { top: tipis, bottom: tipis, left: tipis, right: tipis }
const abu = { style: 'thin' as const, color: { argb: 'FFBFBFBF' } }
const GARIS_ABU: Partial<Borders> = { top: abu, bottom: abu, left: abu, right: abu }
const PUTIH_TEBAL: Partial<Font> = { color: { argb: 'FFFFFFFF' }, bold: true }
const HITAM_TEBAL: Partial<Font> = { color: { argb: 'FF000000' }, bold: true }

// ===== Report Back Tracking =====
export type InfoLaporan = { namaPelaksana: string; tanggalPelaksanaan: string; namaSalesman: string; tanggalDKS: string; tindaklanjut: string }
export type BarisBacktrack = { kodePelanggan: string; namaPelanggan: string; temuanLain: string; hasilDiskusi: string } & Record<KunciIndikator, Indikator>

export async function buatXlsxBacktrack(info: InfoLaporan, rows: BarisBacktrack[]): Promise<ArrayBuffer> {
  const wb = new (await lib()).Workbook(), ws: Worksheet = wb.addWorksheet('BACKTRACK 1')
  ws.columns = [5.71, 19.86, 22, 14, 50.14, 21.14, 50.14, 15.14, 50.14, 26.86, 50.14, 28.86, 50.14, 15.14, 30.57, 36.43].map(width => ({ width }))
  ws.mergeCells('A1:E1'); ws.getCell('A1').value = 'REPORT BACK TRACKING SALES'; ws.getCell('A1').font = { bold: true }; ws.getRow(1).height = 18
  const kop: [string, string][] = [['NAMA PELAKSANA', info.namaPelaksana], ['TANGGAL PELAKSANAAN', info.tanggalPelaksanaan], ['NAMA SALESMAN', info.namaSalesman], ['TANGGAL DKS', info.tanggalDKS]]
  kop.forEach(([k, v], i) => { const r = 2 + i; ws.mergeCells(`A${r}:B${r}`); ws.getCell(`A${r}`).value = k; ws.mergeCells(`C${r}:E${r}`); ws.getCell(`C${r}`).value = v || '' })
  const H1 = 7, H2 = 8, D0 = 9, D1 = D0 + Math.max(rows.length, 1) - 1
  const judul = (ref: string, gabung: string | null, teks: string) => {
    if (gabung) ws.mergeCells(gabung)
    const c = ws.getCell(ref); c.value = teks; c.font = PUTIH_TEBAL; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; c.fill = isi('FF203764'); c.border = GARIS
  }
  judul('A7', 'A7:A8', 'NO'); judul('B7', 'B7:B8', 'KODE PELANGGAN'); judul('C7', 'C7:C8', 'NAMA PELANGGAN')
  const abuKepala = (ref: string, teks: string) => { const c = ws.getCell(ref); c.value = teks; c.font = PUTIH_TEBAL; c.alignment = { horizontal: 'center', vertical: 'middle' }; c.fill = isi('FF808080'); c.border = GARIS }
  abuKepala('D7', 'INDIKATOR'); abuKepala('D8', 'INSTRUKSI')
  const pasang: [string, string, string][] = [['E7', 'E7:F7', INDIKATOR[0].header], ['G7', 'G7:H7', INDIKATOR[1].header], ['I7', 'I7:J7', INDIKATOR[2].header], ['K7', 'K7:L7', INDIKATOR[3].header], ['M7', 'M7:N7', 'Temuan Lain saat di Toko']]
  pasang.forEach(([ref, g, t]) => judul(ref, g, t))
  judul('O7', 'O7:O8', 'Hasil diskusi dengan\nSalesman atas\nketidaksesuaian\n(DKS vs Hasil Back Track)'); judul('P7', 'P7:P8', 'Tindaklanjut ketidaksesuaian')
  const instruksi = (ref: string, t: string) => { const c = ws.getCell(ref); c.value = t; c.font = HITAM_TEBAL; c.alignment = { vertical: 'middle', wrapText: true }; c.fill = isi('FFBFBFBF'); c.border = GARIS }
  const ket = (ref: string) => { const c = ws.getCell(ref); c.value = 'Keterangan'; c.font = HITAM_TEBAL; c.alignment = { horizontal: 'center', vertical: 'middle' }; c.fill = isi('FFBFBFBF'); c.border = GARIS }
  ;(['E8', 'G8', 'I8', 'K8'] as const).forEach((ref, i) => instruksi(ref, INDIKATOR[i].petunjuk)); instruksi('M8', TEMUAN_PETUNJUK)
  ;(['F8', 'H8', 'J8', 'L8', 'N8'] as const).forEach(ket)
  ws.getRow(H1).height = 37.5; ws.getRow(H2).height = 90

  const data = rows.length ? rows : [null]
  data.forEach((row, i) => {
    const r = D0 + i, ind = (k: KunciIndikator): Indikator => row?.[k] ?? { status: '', keterangan: '' }
    ws.getCell(r, 1).value = i + 1; ws.getCell(r, 2).value = row?.kodePelanggan ?? ''
    ws.mergeCells(r, 3, r, 4); ws.getCell(r, 3).value = row?.namaPelanggan ?? ''
    INDIKATOR.forEach((d, j) => { ws.getCell(r, 5 + j * 2).value = ind(d.key).status; ws.getCell(r, 6 + j * 2).value = ind(d.key).keterangan })
    ws.getCell(r, 13).value = row?.temuanLain ?? ''; ws.getCell(r, 14).value = ''; ws.getCell(r, 15).value = row?.hasilDiskusi ?? ''
    for (let c = 1; c <= 15; c++) { const cell: Cell = ws.getCell(r, c); cell.border = GARIS; cell.alignment = { horizontal: [1, 5, 7, 9, 11].includes(c) ? 'center' : 'left', vertical: 'middle', wrapText: true } }
    ws.getRow(r).height = 79.5
  })
  if (D1 > D0) ws.mergeCells(D0, 16, D1, 16)   // tindak lanjut satu nilai untuk seluruh laporan
  ws.getCell(D0, 16).value = info.tindaklanjut || ''; ws.getCell(D0, 16).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
  for (let r = D0; r <= D1; r++) ws.getCell(r, 16).border = GARIS

  const ttd = D1 + 2
  ws.mergeCells(`A${ttd}:B${ttd}`); ws.mergeCells(`C${ttd}:G${ttd}`); ws.getCell(`C${ttd}`).value = 'Dibuat Oleh,'; ws.getCell(`C${ttd}`).font = { bold: true }
  ws.mergeCells(`H${ttd}:L${ttd}`); ws.getCell(`H${ttd}`).value = 'Mengetahui,'; ws.getCell(`H${ttd}`).font = { bold: true }
  const nm = ttd + 3, jb = nm + 1
  ;[`A${nm}:B${nm}`, `C${nm}:F${nm}`, `G${nm}:I${nm}`, `J${nm}:L${nm}`, `A${jb}:B${jb}`, `C${jb}:F${jb}`, `G${jb}:I${jb}`, `J${jb}:L${jb}`].forEach(g => ws.mergeCells(g))
  ;[`C${jb}`, `G${jb}`, `J${jb}`].forEach(ref => { ws.getCell(ref).value = 'Jabatan' })
  const cat = jb + 2
  ws.mergeCells(`B${cat}:E${cat + 3}`); ws.getCell(`B${cat}`).value = KETENTUAN; ws.getCell(`B${cat}`).font = { bold: true }; ws.getCell(`B${cat}`).alignment = { wrapText: true, vertical: 'top' }
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}

// ===== OTJ =====
export type RekamOtj = {
  tipe: TipeOtj; divisi: string; frontliner: string; cabang: string; tanggal: string; dinilaiOleh: string; skor: number | null
  jawabanPra: JawabanMap; jawabanPasca: JawabanMap
  kunjungan: { outletNama: string; jawaban: JawabanMap }[]
  akarMasalah: Record<string, string>; actionPlan: Record<string, string>
}

export async function buatXlsxOtj(t: Template, rec: RekamOtj): Promise<{ buffer: ArrayBuffer; skorA: number | null; skorB: number | null; skorC: number | null }> {
  const wb = new (await lib()).Workbook(), ws = wb.addWorksheet('OTJ')
  const pra = butirBagian(t, 'pra'), kun = butirBagian(t, 'kunjungan'), pasca = butirBagian(t, 'pasca'), v = rec.kunjungan
  const kol = 3 + v.length + 2, tengah = Math.floor(kol / 2)
  ws.columns = [{ width: 5 }, { width: 48 }, ...v.map(() => ({ width: 14 })), { width: 10 }, { width: 32 }, { width: 32 }]
  let r = 1
  ws.mergeCells(r, 1, r, kol); const jd = ws.getCell(r, 1); jd.value = `On-the-Job Assessment - ${t.label}`; jd.font = { ...PUTIH_TEBAL, size: 14 }; jd.alignment = { horizontal: 'center', vertical: 'middle' }; jd.fill = isi('FF1F3864'); ws.getRow(r).height = 26; r++
  const kop: [string, string, string, string | null][] = [['Nama Dinilai', rec.frontliner, 'Nama Cabang', rec.cabang], ['Divisi', rec.divisi, 'Dinilai Oleh', rec.dinilaiOleh], ['Tanggal', rec.tanggal, 'Nilai Total', null]]
  for (const [l1, v1, l2, v2] of kop) {
    ws.getCell(r, 1).value = l1; ws.getCell(r, 1).font = { bold: true }
    ws.mergeCells(r, 2, r, Math.max(3, tengah)); ws.getCell(r, 2).value = v1 || ''; ws.getCell(r, 2).fill = isi('FFFFFF00')
    const lc = tengah + 1; ws.getCell(r, lc).value = l2; ws.getCell(r, lc).font = { bold: true }
    ws.mergeCells(r, lc + 1, r, kol); const c2 = ws.getCell(r, lc + 1)
    if (v2 === null) { c2.value = rec.skor == null ? '-' : `${rec.skor}%`; c2.fill = isi('FF1F3864'); c2.font = PUTIH_TEBAL; c2.alignment = { horizontal: 'center' } }
    else { c2.value = v2 || ''; c2.fill = isi('FFFFFF00') }
    r++
  }
  r++
  const bagian = (teks: string) => { ws.mergeCells(r, 1, r, kol); const c = ws.getCell(r, 1); c.value = teks; c.font = { bold: true }; c.fill = isi('FFDCE6F1'); r++ }
  const sub = (teks: string) => { ws.mergeCells(r, 1, r, kol); const c = ws.getCell(r, 1); c.value = teks; c.font = { bold: true, italic: true }; c.fill = isi('FFF2F2F2'); r++ }
  const satuJawaban = (butir: Butir[], jw: JawabanMap) => {
    const h = ws.getRow(r); h.getCell(1).value = 'No'; h.getCell(2).value = 'Item Penilaian'; h.getCell(3).value = 'Jawaban'
    for (let c = 1; c <= 3; c++) { h.getCell(c).font = { bold: true }; h.getCell(c).border = GARIS_ABU }
    r++
    butir.forEach((b, i) => { const row = ws.getRow(r); row.getCell(1).value = i + 1; row.getCell(2).value = b.label; row.getCell(3).value = jw[b.id] || '-'; for (let c = 1; c <= 3; c++) row.getCell(c).border = GARIS_ABU; r++ })
    const s = skorButir(butir, jw), sr = ws.getRow(r)
    sr.getCell(2).value = 'Skor Section'; sr.getCell(2).font = { bold: true }; sr.getCell(3).value = s == null ? '-' : `${s}%`; sr.getCell(3).font = { bold: true }; r++
    return s
  }
  const perToko = (butir: Butir[]) => {
    const h = ws.getRow(r); h.getCell(1).value = 'No'; h.getCell(2).value = 'Item Penilaian'
    v.forEach((k, i) => { h.getCell(3 + i).value = k.outletNama || `Toko ${i + 1}` }); h.getCell(3 + v.length).value = 'Skor (% Ya)'
    for (let c = 1; c <= 3 + v.length; c++) { h.getCell(c).font = { bold: true }; h.getCell(c).border = GARIS_ABU; h.getCell(c).alignment = { wrapText: true } }
    r++
    let subSaatIni: string | null = null; const semua: string[] = []
    butir.forEach((b, i) => {
      if (b.subTitle !== subSaatIni) { if (b.subTitle) sub(b.subTitle); subSaatIni = b.subTitle }
      const row = ws.getRow(r); row.getCell(1).value = i + 1; row.getCell(2).value = b.label
      const nilai = v.map(k => k.jawaban[b.id] || ''); nilai.forEach((x, j) => { row.getCell(3 + j).value = x || '-' })
      const s = skorPersen(nilai); row.getCell(3 + v.length).value = s == null ? '-' : `${s}%`
      for (let c = 1; c <= 3 + v.length; c++) row.getCell(c).border = GARIS_ABU
      semua.push(...nilai); r++
    })
    return skorPersen(semua)
  }
  bagian('[A] Penilaian Pra-Kunjungan (diisi 1x per hari)'); const skorA = satuJawaban(pra, rec.jawabanPra); r++
  bagian('[B] Penilaian Selama Kunjungan (per toko yang dikunjungi)'); const skorB = perToko(kun); r++
  bagian('[C] Penilaian Pasca-Kunjungan (diisi 1x per hari)'); const skorC = satuJawaban(pasca, rec.jawabanPasca); r++
  bagian('Akar Masalah & Action Plan')
  const nh = ws.getRow(r); nh.getCell(1).value = 'Section'; nh.getCell(2).value = 'Akar Masalah'; nh.getCell(3).value = 'Action Plan'; [1, 2, 3].forEach(c => { nh.getCell(c).font = { bold: true } }); r++
  const catat: [string, string][] = [['[A] Pra-Kunjungan', 'pra'], ['[B] Selama Kunjungan', 'kunjungan'], ['[C] Pasca-Kunjungan', 'pasca']]
  for (const [label, k] of catat) {
    const row = ws.getRow(r); row.getCell(1).value = label
    ws.mergeCells(r, 2, r, tengah); row.getCell(2).value = rec.akarMasalah[k] || '-'
    ws.mergeCells(r, tengah + 1, r, kol); row.getCell(tengah + 1).value = rec.actionPlan[k] || '-'; r++
  }
  return { buffer: (await wb.xlsx.writeBuffer()) as ArrayBuffer, skorA, skorB, skorC }
}
export const namaFileOtj = (rec: RekamOtj) => `OTJ_${rec.tipe.replace(/\s+/g, '_')}_${(rec.frontliner || 'x').replace(/[^a-zA-Z0-9-]+/g, '_')}_${rec.tanggal}.xlsx`
