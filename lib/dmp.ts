export type Row = { src_id: string; name: string; address: string; category: string | null; account: string | null
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
    const src_id = g(r, 'code outlet'), name = g(r, 'name'), address = g(r, 'full_address'), kode_md = g(r, 'kode md')
    const m = /^R0*(\d{1,2})$/i.exec(g(r, 'rayon') || ''); const rayon = m ? +m[1] : 0
    const la = g(r, 'latitude'), lo = g(r, 'longitude')
    const lat = la === null ? null : Number(la), long = lo === null ? null : Number(lo)
    const statusMentah = g(r, 'status'), status = statusMentah === null ? 'AKTIF' : statusMentah.toUpperCase()
    const why = src_id && /^contoh/i.test(src_id) ? 'Baris contoh dari file format. Hapus baris ini atau ganti dengan data asli'
      : !src_id ? 'ID outlet (code outlet) kosong' : !name ? 'Nama kosong' : !address ? 'Alamat kosong'
      : !kode_md || !kode_md.startsWith(kodeCabang + '-') ? `KODE MD harus diawali ${kodeCabang}-`
      : rayon < 1 || rayon > 24 ? 'Rayon harus R01–R24'
      : (la === null) !== (lo === null) ? 'Lat/long harus diisi keduanya atau dikosongkan'
      : (lat !== null && (isNaN(lat) || isNaN(long!) || Math.abs(lat) > 90 || Math.abs(long!) > 180)) ? 'Lat/long tidak valid'
      : status !== 'AKTIF' && status !== 'INAKTIF' ? 'STATUS harus AKTIF atau INAKTIF (kosong dianggap AKTIF)' : ''
    if (why) { rejected.push({ row, reason: why }); continue }
    if (seenExt.has(src_id!)) { dupes.push({ row, reason: 'ID outlet ganda di file' }); continue }
    const key = lat === null ? '' : `${name!.toLowerCase()}|${lat}|${long}`
    if (key && seenKey.has(key)) { dupes.push({ row, reason: 'Double data (nama dan koordinat sama)' }); continue }
    seenExt.add(src_id!); if (key) seenKey.add(key)
    valid.push({ _row: row, src_id: src_id!, name: name!, address: address!, category: g(r, 'category'), account: g(r, 'account'),
      province_name: g(r, 'province'), city_name: g(r, 'city'), district: g(r, 'district / kecamatan'), profile_outlet: g(r, 'profile outlet'),
      lat, long, kode_md: kode_md!, rayon, cycle: g(r, 'cycle'), status })
  }
  return { valid, rejected, dupes }
}

// ---------------------------------------------------------------------------------------------------------------------
// Format file DMP: satu sumber kebenaran untuk pemeriksaan sebelum upload, format contoh yang bisa diunduh, dan petunjuk pengisian.
export type KolomDmp = { nama: string; judul: string; wajib: boolean; ket: string; contoh: string }
export const KOLOM_DMP: KolomDmp[] = [
  { nama: 'code outlet', judul: 'code outlet', wajib: true, ket: 'ID unik outlet dari DMP. Tidak boleh kosong dan tidak boleh ganda dalam satu file.', contoh: '300123456' },
  { nama: 'name', judul: 'name', wajib: true, ket: 'Nama outlet.', contoh: 'Warung Sumber Rejeki' },
  { nama: 'category', judul: 'category', wajib: false, ket: 'Kategori outlet.', contoh: 'General Trade' },
  { nama: 'account', judul: 'account', wajib: false, ket: 'Account outlet.', contoh: 'Retail' },
  { nama: 'full_address', judul: 'full_address', wajib: true, ket: 'Alamat lengkap outlet.', contoh: 'Jl. Rawa Kepiting No. 1, Cakung' },
  { nama: 'province', judul: 'province', wajib: false, ket: 'Provinsi.', contoh: 'DKI Jakarta' },
  { nama: 'city', judul: 'city', wajib: false, ket: 'Kota atau kabupaten.', contoh: 'Jakarta Timur' },
  { nama: 'district / kecamatan', judul: 'district / kecamatan', wajib: false, ket: 'Kecamatan.', contoh: 'Cakung' },
  { nama: 'profile outlet', judul: 'profile outlet', wajib: false, ket: 'Profil outlet.', contoh: 'Warung' },
  { nama: 'latitude', judul: 'latitude', wajib: true, ket: 'Garis lintang, memakai titik desimal, antara -90 dan 90. Kosongkan bersama longitude jika koordinat belum ada (outlet tetap disimpan).', contoh: '-6.2088' },
  { nama: 'longitude', judul: 'longitude', wajib: true, ket: 'Garis bujur, memakai titik desimal, antara -180 dan 180. Harus diisi bersama latitude atau dikosongkan bersama.', contoh: '106.8456' },
  { nama: 'kode md', judul: 'KODE MD', wajib: true, ket: 'Kode MD pemegang outlet. Harus diawali kode cabang tujuan dan tanda minus.', contoh: '0300-TMTB01' },
  { nama: 'rayon', judul: 'RAYON', wajib: true, ket: 'R01 sampai R24 (huruf R lalu nomor rayon).', contoh: 'R01' },
  { nama: 'cycle', judul: 'CYCLE', wajib: false, ket: 'Siklus kunjungan.', contoh: 'C1' },
  { nama: 'status', judul: 'STATUS', wajib: false, ket: 'AKTIF atau INAKTIF. Kosong dianggap AKTIF. Hanya outlet AKTIF yang muncul di HP frontliner.', contoh: 'AKTIF' },
]
const WAJIB = KOLOM_DMP.filter(k => k.wajib).map(k => k.nama), DIKENAL = KOLOM_DMP.map(k => k.nama)
export const judulKolom = (nama: string) => KOLOM_DMP.find(k => k.nama === nama)?.judul ?? nama

const norm = (c: unknown) => String(c ?? '').trim().toLowerCase()
const sandi = (c: unknown) => norm(c).replace(/[^a-z0-9]/g, '')
// Nama lain yang lazim dipakai untuk kolom yang sama. Hanya dipakai untuk memberi petunjuk ("ganti namanya menjadi ..."), bukan untuk menerima file.
const ALIAS: Record<string, string> = { idoutlet: 'code outlet', outletid: 'code outlet', outletcode: 'code outlet', kodeoutlet: 'code outlet', nama: 'name', namaoutlet: 'name', outletname: 'name',
  alamat: 'full_address', address: 'full_address', alamatlengkap: 'full_address', lat: 'latitude', lintang: 'latitude', lng: 'longitude', lon: 'longitude', long: 'longitude', bujur: 'longitude',
  md: 'kode md', kodemd: 'kode md', rayonmd: 'rayon', kecamatan: 'district / kecamatan', district: 'district / kecamatan', provinsi: 'province', kota: 'city' }

export type Pemeriksaan = {
  ok: boolean; sheet: string | null; barisHeader: number | null; jumlahBaris: number
  hilang: string[]                                   // kolom wajib yang tidak ada (nama baku)
  mirip: { ada: string; seharusnya: string }[]       // kolom yang namanya hampir sama: perlu diganti namanya
  tambahan: string[]                                 // kolom lain di file: diabaikan
  opsionalTidakAda: string[]; masalah: string[]
}
type Lembar = { nama: string; baris: unknown[][] }

function periksaLembar(l: Lembar): Pemeriksaan {
  let best = -1, bestN = 1
  l.baris.forEach((r, i) => { const n = new Set((r || []).map(norm).filter(c => DIKENAL.includes(c))).size; if (n > bestN) { best = i; bestN = n } })
  const kosong = (m: string): Pemeriksaan => ({ ok: false, sheet: l.nama, barisHeader: null, jumlahBaris: 0, hilang: [...WAJIB], mirip: [], tambahan: [], opsionalTidakAda: [], masalah: [m] })
  if (best < 0) return kosong('Baris judul kolom tidak dikenali. Pastikan ada baris judul seperti pada format contoh (code outlet, name, full_address, ...).')
  const header = (l.baris[best] || []).map(norm), ada = new Set(header)
  const hilang = WAJIB.filter(k => !ada.has(k))
  const mirip: Pemeriksaan['mirip'] = [], dipakai = new Set<string>()
  for (const k of hilang) {
    const idx = header.findIndex((c, i) => c !== '' && !DIKENAL.includes(c) && !dipakai.has(String(i)) && (sandi(c) === sandi(k) || ALIAS[sandi(c)] === k))
    if (idx >= 0) { dipakai.add(String(idx)); mirip.push({ ada: String((l.baris[best] || [])[idx]).trim(), seharusnya: judulKolom(k) }) }
  }
  const tambahan = header.map((c, i) => ({ c, i })).filter(({ c, i }) => c !== '' && c !== 'no' && !DIKENAL.includes(c) && !dipakai.has(String(i))).map(({ i }) => String((l.baris[best] || [])[i]).trim())
  const masalah: string[] = []
  if (hilang.length) masalah.push(`Kolom wajib tidak ditemukan: ${hilang.map(judulKolom).join(', ')}.`)
  for (const m of mirip) masalah.push(`Kolom "${m.ada}" hampir sama dengan "${m.seharusnya}". Ganti namanya persis menjadi "${m.seharusnya}".`)
  const jumlahBaris = l.baris.slice(best + 1).filter(r => r && r.some(c => c != null && String(c).trim() !== '')).length
  return { ok: hilang.length === 0, sheet: l.nama, barisHeader: best + 1, jumlahBaris, hilang, mirip, tambahan,
    opsionalTidakAda: KOLOM_DMP.filter(k => !k.wajib && !ada.has(k.nama)).map(k => k.judul), masalah }
}

// Memeriksa semua sheet dan memilih satu yang akan dibaca: sheet bernama DMP jika formatnya sesuai, lalu sheet sesuai pertama yang berisi data,
// lalu sheet sesuai pertama. Jika tidak ada yang sesuai, dikembalikan sheet yang paling mendekati supaya pesannya berguna.
export function periksaFormatDmp(lembar: Lembar[]): Pemeriksaan {
  if (!lembar.length) return { ok: false, sheet: null, barisHeader: null, jumlahBaris: 0, hilang: [...WAJIB], mirip: [], tambahan: [], opsionalTidakAda: [], masalah: ['File tidak memiliki sheet.'] }
  const hasil = lembar.map(periksaLembar), sesuai = hasil.filter(h => h.ok)
  if (sesuai.length) return sesuai.find(h => norm(h.sheet) === 'dmp') || sesuai.find(h => h.jumlahBaris > 0) || sesuai[0]
  return [...hasil].sort((a, b) => a.hilang.length - b.hilang.length)[0]
}
