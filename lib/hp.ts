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


// Sisa detik sebelum check-out boleh dilakukan (0 = boleh). menit = batas minimal dari check-in; 0 = tanpa batas.
export const sisaDetik = (checkinIso: string, menit: number, now = Date.now()) => (menit > 0 ? Math.max(0, Math.ceil((new Date(checkinIso).getTime() + menit * 60000 - now) / 1000)) : 0)
export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

// Alamat singkat untuk daftar outlet: buang provinsi, kota/kabupaten, negara, dan kode pos yang berulang di tiap baris. Maksimal dua bagian.
const BUANG = /^(daerah khusus ibukota jakarta|dki jakarta|provinsi .+|kota .+|kabupaten .+|kab\.? .+|jakarta (utara|selatan|barat|timur|pusat)|indonesia|\d{5})$/i
export function ringkasAlamat(alamat: string | null | undefined, maks = 2): string {
  const a = (alamat || '').trim(); if (!a) return ''
  const bagian = a.split(',').map(x => x.trim().replace(/\s+\d{5}$/, '')).filter(Boolean)
  const sisa = bagian.filter(x => !BUANG.test(x))
  return (sisa.length ? sisa : bagian).slice(0, maks).join(', ')
}
