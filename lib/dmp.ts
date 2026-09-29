export type Row = { ext_id: string; name: string; address: string; category: string | null; account: string | null
  province_name: string | null; city_name: string | null; district: string | null; profile_outlet: string | null
  lat: number | null; long: number | null; kode_md: string; rayon: number; cycle: string | null; status: string }
export type Rejected = { row: number; reason: string }

const s = (v: any) => (v == null || String(v).trim() === '' ? null : String(v).trim())

// sheet: baris-baris mentah dari Excel. kodeCabang: mis. "0300".
export function parseDmp(sheet: any[][], kodeCabang: string) {
  const h = sheet.findIndex(r => r.some(c => String(c).trim().toLowerCase() === 'kode md') && r.some(c => String(c).trim().toLowerCase() === 'name'))
  if (h < 0) throw new Error('Header tidak ditemukan (butuh kolom name dan KODE MD)')
  const col: Record<string, number> = {}
  sheet[h].forEach((c, i) => { if (c != null) col[String(c).trim().toLowerCase()] = i })
  const miss = ['code outlet', 'name', 'full_address', 'latitude', 'longitude', 'kode md', 'rayon'].filter(k => !(k in col))
  if (miss.length) throw new Error('Kolom tidak ada: ' + miss.join(', '))
  const g = (r: any[], k: string) => (k in col ? s(r[col[k]]) : null)

  const valid: (Row & { _row: number })[] = [], rejected: Rejected[] = [], dupes: Rejected[] = []
  const seenExt = new Set<string>(), seenKey = new Set<string>()
  for (let i = h + 1; i < sheet.length; i++) {
    const r = sheet[i]; const row = i + 1
    if (!r || r.every(c => c == null || c === '')) continue
    const ext_id = g(r, 'code outlet'), name = g(r, 'name'), address = g(r, 'full_address'), kode_md = g(r, 'kode md')
    const m = /^R0*(\d{1,2})$/i.exec(g(r, 'rayon') || ''); const rayon = m ? +m[1] : 0
    const la = g(r, 'latitude'), lo = g(r, 'longitude')
    const lat = la === null ? null : Number(la), long = lo === null ? null : Number(lo)
    const why = !ext_id ? 'ID outlet (code outlet) kosong' : !name ? 'Nama kosong' : !address ? 'Alamat kosong'
      : !kode_md || !kode_md.startsWith(kodeCabang + '-') ? `KODE MD harus diawali ${kodeCabang}-`
      : rayon < 1 || rayon > 24 ? 'Rayon harus R01–R24'
      : (la === null) !== (lo === null) ? 'Lat/long harus diisi keduanya atau dikosongkan'
      : (lat !== null && (isNaN(lat) || isNaN(long!) || Math.abs(lat) > 90 || Math.abs(long!) > 180)) ? 'Lat/long tidak valid' : ''
    if (why) { rejected.push({ row, reason: why }); continue }
    if (seenExt.has(ext_id!)) { dupes.push({ row, reason: 'ID outlet ganda di file' }); continue }
    const key = lat === null ? '' : `${name!.toLowerCase()}|${lat}|${long}`
    if (key && seenKey.has(key)) { dupes.push({ row, reason: 'Double data (nama dan koordinat sama)' }); continue }
    seenExt.add(ext_id!); if (key) seenKey.add(key)
    valid.push({ _row: row, ext_id: ext_id!, name: name!, address: address!, category: g(r, 'category'), account: g(r, 'account'),
      province_name: g(r, 'province'), city_name: g(r, 'city'), district: g(r, 'district / kecamatan'), profile_outlet: g(r, 'profile outlet'),
      lat, long, kode_md: kode_md!, rayon, cycle: g(r, 'cycle'), status: g(r, 'status') || 'AKTIF' })
  }
  return { valid, rejected, dupes }
}
