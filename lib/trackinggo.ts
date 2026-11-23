// Logika Tracking Go (Back Tracking) yang tidak bergantung pada tampilan, supaya bisa diuji sendiri.
// Sumber datanya kunjungan, penjualan, dan outlet TaskPro yang sudah ada: tidak ada upload data.
import { day, TZ } from './rekap'

export const RADIUS_M = 50   // harus sama dengan angka 50 di backtrack_simpan (22_migration.sql); jarak yang menentukan dihitung di database

export type Status = 'Sesuai' | 'TS' | 'N/A'
export const STATUS_PILIHAN: Status[] = ['Sesuai', 'TS', 'N/A']
export type Indikator = { status: Status | ''; keterangan: string }
export type KunciIndikator = 'jam_kunjungan' | 'on_rayon' | 'kunjungan_manual' | 'pv_satu'

// Teks dan urutan mengikuti form asli "Report Back Tracking Sales". "A" = acuan pemeriksaan, "S" = Sesuai, "TS" = Tidak Sesuai.
export const INDIKATOR: { key: KunciIndikator; judul: string; header: string; petunjuk: string }[] = [
  { key: 'jam_kunjungan', judul: 'Jam Kunjungan Toko Pertama (Jarak toko dari Kantor)', header: 'Jam Kunjungan Toko Pertama\n(Jarak toko dari Kantor)',
    petunjuk: 'A : Pastikan kesesuaian jarak Toko pertama dari Kantor vs waktu tempuh menuju ke Toko Pertama\nS : Waktu tempuh Normal dan tidak menyimpang\nTS : Waktu tempuh Tidak Normal dan berindikasi menyimpang\nN/A : Jika yang di backtrack bukan Toko yang pertama' },
  { key: 'on_rayon', judul: 'Alasan kunjungan On Rayon Tidak Dikunjungi', header: 'Alasan kunjungan On Rayon Tidak\nDikunjungi',
    petunjuk: 'A : Pastikan kesesuaian alasan di DKS vs Konfirmasi ke Toko\nS : Alasan di DKS sama dengan hasil konfirmasi ke Toko\nTS : Alasan di DKS vs konfirmasi ke Toko tidak sama' },
  { key: 'kunjungan_manual', judul: 'Kunjungan manual (M)', header: 'Kunjungan manual (M)',
    petunjuk: 'A : Pastikan kesesuaian radius absen vs hasil konfirmasi dari Toko\nS : Salesman benar melakukan visit ke Toko\nTS : Salesman tidak melakukan visit ke Toko' },
  { key: 'pv_satu', judul: 'PV ≤ 1', header: 'PV ≤ 1',
    petunjuk: 'A : Konfirmasi kesesuaian order ke Toko yang ada di DKS Sales.\nS : Transaksi sesuai inputan orderan salesman dan Toko mengakui transaksi\nTS : Jika Toko tidak melakukan order (order fiktif)' },
]
export const TEMUAN_PETUNJUK = 'A : Diisi jika terdapat catatan dari Toko diluar 4 pertanyaan sebelumnya. Termasuk bila ada masukan/keluhan/temuan lain terkait proses kerja salesman.'
export const KETENTUAN = 'Ketentuan Form Back Track:\n1. Dasar Backtrack adalah kunjungan Salesman/ DKS pada minggu berjalan pelaksanaan backtrack\n2. Pemilihan toko minimal 50% dari kunjungan Salesman pada tanggal tersebut\n3. Backtrack dilakukan seminggu sekali dan 1 Salesman'

// ===== Bentuk data dari database =====
export type JualRow = { qty: number; price: number | string; value: number | string; products: { product: string } | null }
export type KunjunganRow = {
  id: string; outlet_id: number; checkin_at: string; checkout_at: string | null; cabang_id: string
  cabang: { tz: string } | null
  outlets: { code: string | null; name: string; address: string | null; lat: number | null; long: number | null; created_at: string | null } | null
  sales: JualRow[]
}
export type KonfirmasiRow = {
  id: string; visit_id: string | null; cabang_id: string; frontliner_id: string | null; frontliner_user_id: string | null; frontliner_nama: string | null
  outlet_id: number | null; outlet_kode: string | null; outlet_nama: string | null; visit_date: string; checkin_at: string | null
  toko_ada: boolean; penjualan_sesuai: boolean
  jam_kunjungan: Indikator; on_rayon: Indikator; kunjungan_manual: Indikator; pv_satu: Indikator
  temuan_lain: string; hasil_diskusi: string; jarak_m: number | null
  oleh_user_id: string | null; oleh_nama: string | null; oleh_role: string | null; created_at: string
}

export type Stop = {
  visitId: string; outletId: number; kode: string; nama: string; alamat: string; lat: number | null; lng: number | null
  checkinAt: string; checkoutAt: string | null; tz: string
  durasiDtk: number | null; jedaDtk: number | null; tumpangTindih: boolean; checkoutBedaHari: boolean; pertama: boolean
  outletDibuat: string | null
  items: { produk: string; qty: number; value: number }[]; total: number
  konfirmasi: KonfirmasiRow | null
}

const dtk = (a: string, b: string) => Math.round((+new Date(b) - +new Date(a)) / 1000)

// Urutan rute satu frontliner pada satu hari: urut jam check-in, lengkap dengan durasi di outlet dan jeda dari outlet sebelumnya
// (check-out outlet sebelumnya sampai check-in outlet ini). Durasi dihitung dari waktu check-in/check-out sungguhan, jadi check-out
// yang jatuh di hari lain (lupa check-out) tetap terhitung benar dan diberi penanda.
export function susunRute(visits: KunjunganRow[], konfirmasi: KonfirmasiRow[]): Stop[] {
  const perVisit = new Map(konfirmasi.filter(k => k.visit_id).map(k => [k.visit_id as string, k]))
  const urut = [...visits].sort((a, b) => +new Date(a.checkin_at) - +new Date(b.checkin_at))
  const stops: Stop[] = urut.map(v => {
    const tz = v.cabang?.tz || TZ, o = v.outlets
    const items = (v.sales || []).map(s => ({ produk: s.products?.product || '-', qty: s.qty, value: Number(s.value) || 0 }))
    return {
      visitId: v.id, outletId: v.outlet_id, kode: o?.code || String(v.outlet_id), nama: o?.name || `Outlet ${v.outlet_id}`, alamat: o?.address || '-',
      lat: o?.lat ?? null, lng: o?.long ?? null, checkinAt: v.checkin_at, checkoutAt: v.checkout_at, tz,
      durasiDtk: v.checkout_at ? dtk(v.checkin_at, v.checkout_at) : null, jedaDtk: null, tumpangTindih: false,
      checkoutBedaHari: !!v.checkout_at && day(v.checkout_at, tz) !== day(v.checkin_at, tz), pertama: false,
      outletDibuat: o?.created_at ?? null, items, total: items.reduce((t, i) => t + i.value, 0), konfirmasi: perVisit.get(v.id) ?? null,
    }
  })
  return stops.map((s, i) => {
    const prev = i > 0 ? stops[i - 1] : null
    const jeda = prev?.checkoutAt ? dtk(prev.checkoutAt, s.checkinAt) : null
    return { ...s, pertama: i === 0, jedaDtk: jeda, tumpangTindih: jeda !== null && jeda < 0 }
  })
}

export type RingkasOutlet = { outletId: number; kode: string; nama: string; alamat: string; lat: number | null; lng: number | null; kunjungan: number; total: number; outletDibuat: string | null; tz: string }
// Ringkasan banyak hari: satu baris per outlet yang dikunjungi, dengan jumlah kunjungan dan total penjualan.
export function ringkasOutlet(visits: KunjunganRow[]): RingkasOutlet[] {
  const m = new Map<number, RingkasOutlet>()
  for (const v of visits) {
    const o = v.outlets
    const r = m.get(v.outlet_id) ?? { outletId: v.outlet_id, kode: o?.code || String(v.outlet_id), nama: o?.name || `Outlet ${v.outlet_id}`, alamat: o?.address || '-', lat: o?.lat ?? null, lng: o?.long ?? null, kunjungan: 0, total: 0, outletDibuat: o?.created_at ?? null, tz: v.cabang?.tz || TZ }
    r.kunjungan++; r.total += (v.sales || []).reduce((t, s) => t + (Number(s.value) || 0), 0)
    m.set(v.outlet_id, r)
  }
  return [...m.values()].sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
}

// ===== Format tampilan =====
export const formatJarak = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`)
// 47 -> "47 dtk", 287 -> "4 mnt 47 dtk", 1500 -> "25 mnt", 3900 -> "1 jam 5 mnt". Nilai negatif ditulis tanpa tanda (tandanya dijelaskan di tampilan).
export function formatDurasi(detik: number | null | undefined): string {
  if (detik == null || Number.isNaN(detik)) return '-'
  const s = Math.round(Math.abs(detik))
  if (s < 60) return `${s} dtk`
  if (s < 3600) { const m = Math.floor(s / 60), r = s % 60; return r ? `${m} mnt ${r} dtk` : `${m} mnt` }
  const j = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return m ? `${j} jam ${m} mnt` : `${j} jam`
}
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
// "2026-09-11" -> "11 September 2026". Teks selain tanggal ISO dikembalikan apa adanya.
export function tglIndo(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd), bln = m ? BULAN[Number(m[2]) - 1] : undefined
  return m && bln ? `${Number(m[3])} ${bln} ${m[1]}` : ymd
}
// Waktu kejadian (timestamptz) -> "5 Juli 2025" menurut zona waktu cabang.
export const tglIndoDari = (iso: string, tz = TZ) => tglIndo(day(iso, tz))
export const namaFile = (s: string) => s.replace(/[^a-zA-Z0-9-]+/g, '_').replace(/^_+|_+$/g, '') || 'x'

// ===== Lokasi =====
const R_BUMI = 6371000
// Jarak dua titik (meter), rumus Haversine. Hanya untuk tampilan "x m dari Anda"; batas 50 m yang mengikat dihitung di database.
export function jarakM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180, dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R_BUMI * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
export const urlMaps = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
// Petunjuk arah ke outlet (membuka navigasi di aplikasi Google Maps)
export const urlNavigasi = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`

export type Titik = { lat: number; lng: number; acc: number }
const PESAN_GPS: Record<number, string> = {
  1: 'Izin lokasi ditolak. Aktifkan izin lokasi untuk browser ini di pengaturan, lalu coba lagi.',
  2: 'Lokasi tidak terdeteksi. Pastikan GPS/Layanan Lokasi aktif, lalu coba lagi.',
  3: 'Waktu deteksi lokasi habis. Coba lagi di tempat terbuka.',
}
// Posisi GPS terbaru (tanpa cache). Mencoba akurasi tinggi dulu, lalu akurasi rendah bila gagal. Galat berupa Error berpesan jelas.
export function ambilPosisi(): Promise<Titik> {
  const coba = (opsi: PositionOptions) => new Promise<Titik>((ok, gagal) =>
    navigator.geolocation.getCurrentPosition(p => ok({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }), gagal, opsi))
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.reject(new Error('Perangkat atau browser ini tidak mendukung lokasi GPS.'))
  return coba({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })
    .catch(() => coba({ enableHighAccuracy: false, timeout: 15000, maximumAge: 0 }))
    .catch((e: GeolocationPositionError) => { throw new Error(PESAN_GPS[e?.code] || 'Gagal mengambil lokasi GPS.') })
}

// Batas rentang tanggal (ISO, dengan offset zona) untuk menyaring checkin_at: [awal hari `dari`, awal hari setelah `sampai`).
export function batasWaktu(dari: string, sampai: string, offset: string): { a: string; b: string } {
  const b = new Date(Date.parse(`${sampai}T00:00:00${offset}`) + 864e5)
  return { a: `${dari}T00:00:00${offset}`, b: b.toISOString() }
}
export const hariAntara = (dari: string, sampai: string) => Math.round((Date.parse(sampai) - Date.parse(dari)) / 864e5) + 1
