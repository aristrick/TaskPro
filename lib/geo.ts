// Alamat otomatis dari titik lat/long (OpenStreetMap Nominatim; untuk pemakaian ringan). Gagal = null, isi manual.
export async function alamatDari(lat: number, lng: number) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=id&lat=${lat}&lon=${lng}`)
    const j = await r.json(); const a = j.address || {}
    const address = [a.road, a.suburb || a.village, a.city_district].filter(Boolean).join(', ') || String(j.display_name || '').split(',').slice(0, 3).join(',').trim()
    return { address, province_name: a.state || null, city_name: a.city || a.municipality || a.county || null, district: a.city_district || a.county || null }
  } catch { return null }
}
