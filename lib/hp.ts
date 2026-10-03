// Pembantu halaman HP frontliner (tanpa React): jarak, format, getar, dan posisi GPS.
const R = 6371000, rad = (x: number) => (x * Math.PI) / 180
export const meters = (a: number, b: number, c: number, d: number) => {
  const h = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
export const fresh = () => new Promise<GeolocationPosition>((ok, no) => navigator.geolocation.getCurrentPosition(ok, no, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }))
export const payload = (p: GeolocationPosition | null) => (p ? { p_lat: p.coords.latitude, p_lng: p.coords.longitude, p_acc: p.coords.accuracy } : { p_lat: null, p_lng: null, p_acc: null })
export const fmt = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`)
export const QUICK = [1, 2, 5, 10]
export const buzz = (ms = 14) => { try { navigator.vibrate?.(ms) } catch {} }

