// Baca dan tulis Excel (.xlsx) memakai ExcelJS. Dipakai oleh Import DMP, halaman Outlet, dan Report.
// Sengaja membungkus library-nya di satu tempat supaya mudah diganti, dan nilai sel selalu disederhanakan
// menjadi teks/angka/boolean (rumus, teks berformat, dan tautan diambil hasilnya).
export type Sel = string | number | boolean | null
export type Sheet = { nama: string; baris: Sel[][] }

export const MAKS_BYTE = 10 * 1024 * 1024   // file di atas 10 MB ditolak sebelum dibaca (melindungi memori HP/PC)
const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export function sederhanakan(v: any): Sel {
  if (v == null) return null
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (Array.isArray(v?.richText)) return v.richText.map((x: any) => x.text ?? '').join('')
  if ('result' in v) return sederhanakan(v.result)            // rumus: pakai hasil hitungnya
  if ('text' in v) return sederhanakan(v.text)                // tautan
  return null                                                 // error sel (#N/A dst) dianggap kosong
}

async function lib() { const m: any = await import('exceljs'); return m.default ?? m }

export async function bacaXlsx(data: ArrayBuffer): Promise<Sheet[]> {
  if (data.byteLength > MAKS_BYTE) throw new Error('File terlalu besar (maksimal 10 MB). Pecah file menjadi beberapa bagian.')
  const wb = new (await lib()).Workbook()
  try { await wb.xlsx.load(data) } catch { throw new Error('File tidak bisa dibaca. Pastikan formatnya .xlsx (bukan .xls atau .csv).') }
  return wb.worksheets.map((ws: any) => {
    const baris: Sel[][] = [], kol = ws.columnCount
    for (let r = 1; r <= ws.rowCount; r++) { const row = ws.getRow(r); const a: Sel[] = []; for (let c = 1; c <= kol; c++) a.push(sederhanakan(row.getCell(c).value)); baris.push(a) }
    return { nama: ws.name, baris }
  })
}

// Susun file .xlsx dari daftar objek: judul kolom = kunci objek, urut sesuai kemunculan pertama.
export async function buatXlsx(namaSheet: string, data: Record<string, unknown>[]): Promise<ArrayBuffer> {
  const wb = new (await lib()).Workbook(), ws = wb.addWorksheet(namaSheet.slice(0, 31))
  const kunci: string[] = []; for (const d of data) for (const k of Object.keys(d)) if (!kunci.includes(k)) kunci.push(k)
  ws.addRow(kunci)
  for (const d of data) ws.addRow(kunci.map(k => (d[k] as any) ?? ''))
  ws.getRow(1).font = { bold: true }; ws.views = [{ state: 'frozen', ySplit: 1 }]
  kunci.forEach((k, i) => { ws.getColumn(i + 1).width = Math.min(40, Math.max(k.length, ...data.slice(0, 200).map(d => String(d[k] ?? '').length)) + 2) })
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}

// Unduh di browser.
export async function unduhXlsx(namaFile: string, namaSheet: string, data: Record<string, unknown>[]) {
  const url = URL.createObjectURL(new Blob([await buatXlsx(namaSheet, data)], { type: MIME }))
  const a = document.createElement('a'); a.href = url; a.download = namaFile; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
