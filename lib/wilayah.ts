// Penentuan Provinsi dari hasil geocoding, berlapis agar tetap terisi walaupun satu sumber kosong:
// 1) kode ISO provinsi (ID-JK dst)  2) kolom state  3) nama provinsi di display_name  4) petunjuk dari nama kota (Jabodetabek).
export const PROVINSI = ['Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Kepulauan Riau', 'Jambi', 'Sumatera Selatan', 'Kepulauan Bangka Belitung', 'Bengkulu', 'Lampung',
  'DKI Jakarta', 'Jawa Barat', 'Banten', 'Jawa Tengah', 'DI Yogyakarta', 'Jawa Timur', 'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur',
  'Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara', 'Sulawesi Utara', 'Sulawesi Tengah', 'Sulawesi Selatan',
  'Sulawesi Tenggara', 'Gorontalo', 'Sulawesi Barat', 'Maluku', 'Maluku Utara', 'Papua', 'Papua Barat', 'Papua Selatan', 'Papua Tengah', 'Papua Pegunungan', 'Papua Barat Daya']

const ISO: Record<string, string> = { AC: 'Aceh', SU: 'Sumatera Utara', SB: 'Sumatera Barat', RI: 'Riau', KR: 'Kepulauan Riau', JA: 'Jambi', SS: 'Sumatera Selatan',
  BB: 'Kepulauan Bangka Belitung', BE: 'Bengkulu', LA: 'Lampung', JK: 'DKI Jakarta', JB: 'Jawa Barat', BT: 'Banten', JT: 'Jawa Tengah', YO: 'DI Yogyakarta', JI: 'Jawa Timur',
  BA: 'Bali', NB: 'Nusa Tenggara Barat', NT: 'Nusa Tenggara Timur', KB: 'Kalimantan Barat', KT: 'Kalimantan Tengah', KS: 'Kalimantan Selatan', KI: 'Kalimantan Timur',
  KU: 'Kalimantan Utara', SA: 'Sulawesi Utara', ST: 'Sulawesi Tengah', SN: 'Sulawesi Selatan', SG: 'Sulawesi Tenggara', GO: 'Gorontalo', SR: 'Sulawesi Barat',
  MA: 'Maluku', MU: 'Maluku Utara', PA: 'Papua', PB: 'Papua Barat', PS: 'Papua Selatan', PT: 'Papua Tengah', PE: 'Papua Pegunungan', PD: 'Papua Barat Daya' }

// Samakan penulisan ("Daerah Khusus Ibukota Jakarta" -> "DKI Jakarta"). Tidak dikenal = null.
export function kanon(raw?: string | null): string | null {
  if (!raw) return null
  let n = String(raw).toLowerCase().trim().replace(/^provinsi\s+/, '').replace(/daerah khusus ibu ?kota|special capital region of/g, 'dki')
    .replace(/daerah istimewa|special region of/g, 'di').replace(/\s+/g, ' ')
  if (/jakarta/.test(n)) return 'DKI Jakarta'
  if (/yogyakarta/.test(n)) return 'DI Yogyakarta'
  const exact = PROVINSI.find(p => p.toLowerCase() === n); if (exact) return exact
  const hit = PROVINSI.filter(p => n.includes(p.toLowerCase())).sort((a, b) => b.length - a.length)[0]
  return hit || null
}

const HINT: [RegExp, string][] = [[/jakarta/i, 'DKI Jakarta'], [/bekasi|depok|bogor|karawang|purwakarta|bandung|cimahi|sukabumi|cirebon|cianjur|subang/i, 'Jawa Barat'],
  [/tangerang|serang|cilegon|lebak|pandeglang/i, 'Banten']]

export function provinsiDari(j: any): string | null {
  const a = j?.address || {}
  for (const k of Object.keys(a)) if (k.startsWith('ISO3166-2') && /^ID-/.test(a[k])) { const p = ISO[String(a[k]).slice(3)]; if (p) return p }
  const dariState = kanon(a.state) || kanon(a.region)
  if (dariState) return dariState
  const parts = String(j?.display_name || '').split(',').map((s: string) => s.trim()).reverse()
  for (const part of parts) { const p = kanon(part); if (p) return p }
  const kota = [a.city, a.municipality, a.county, a.city_district, a.state_district].filter(Boolean).join(' ')
  for (const [re, p] of HINT) if (re.test(kota)) return p
  return null
}
