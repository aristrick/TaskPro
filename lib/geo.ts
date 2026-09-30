// Alamat otomatis dari titik lat/long (OpenStreetMap Nominatim; pemakaian ringan). Gagal = null -> isi manual.
const kota = (s?: string) => !!s && /^(kota|kabupaten|jakarta )/i.test(s)

export function petakan(j: any) {
  const a = j?.address || {}
  const village = a.village || a.neighbourhood || a.suburb || null
  let district = a.suburb && a.suburb !== village ? a.suburb : a.city_district && !kota(a.city_district) ? a.city_district : null
  if (!district && a.county && !kota(a.county)) district = a.county
  if (!district) district = a.suburb || null
  const city = a.city || a.municipality || (kota(a.city_district) ? a.city_district : null) || a.county || null
  const address = [a.road, village, district !== village ? district : null, city].filter(Boolean).join(', ')
    || String(j?.display_name || '').split(',').slice(0, 3).join(',').trim()
  return { address, province_name: a.state || null, city_name: city, district, village }
}

export async function alamatDari(lat: number, lng: number) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=id&lat=${lat}&lon=${lng}`)
    return petakan(await r.json())
  } catch { return null }
}
