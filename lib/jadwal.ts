// Schedule Taskforce: pembantu murni (tanpa React dan tanpa jaringan) untuk jadwal rayon per frontliner.
// 24 rayon = 4 minggu x 6 hari (Senin–Sabtu). Tiap hari boleh berisi satu atau beberapa rayon. Aturan dan database: 19_migration.sql.
export const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const
export const MINGGU = [1, 2, 3, 4] as const
export const RAYON = Array.from({ length: 24 }, (_, i) => i + 1)

export type Baris = { id: string; minggu: number; hari: number; rayon: number }   // hari: 1 = Senin ... 6 = Sabtu
export type JadwalHariIni = { locked: boolean; minggu: number | null; hari: number | null; rayon: number[] }

export const kodeRayon = (r: number) => `R${String(r).padStart(2, '0')}`
export const ringkasRayon = (r: number[]) => r.map(kodeRayon).join(', ')
export const namaHari = (h: number) => HARI[h - 1] ?? 'Minggu'   // 7 (atau di luar 1–6) = Minggu, hari tanpa jadwal
export const labelHari = (minggu: number, hari: number) => `Minggu ke ${minggu} · ${namaHari(hari)}`
// Rayon bawaan untuk "Isi urut": Minggu 1 Senin = R01 ... Minggu 4 Sabtu = R24.
export const rayonUrut = (minggu: number, hari: number) => (minggu - 1) * 6 + hari

// Rayon pada satu hari (terurut). Satu hari boleh lebih dari satu rayon.
export const rayonHari = (rows: Baris[], minggu: number, hari: number) =>
  rows.filter(x => x.minggu === minggu && x.hari === hari).sort((a, b) => a.rayon - b.rayon)
// Jumlah hari (dari 6) yang sudah punya jadwal pada satu minggu.
export const hariTerisi = (rows: Baris[], minggu: number) => new Set(rows.filter(x => x.minggu === minggu).map(x => x.hari)).size
// Di mana saja sebuah rayon sudah dijadwalkan (untuk petunjuk "sudah dipakai di ...").
export const letakRayon = (rows: Baris[], rayon: number) => rows.filter(x => x.rayon === rayon).sort((a, b) => a.minggu - b.minggu || a.hari - b.hari)

// Outlet per rayon, dari daftar outlet satu frontliner.
export type OutletJadwal = { id: number; ext_id: string | null; name: string; address: string; rayon: number | null }
export const perRayon = (outlets: OutletJadwal[]) => {
  const m = new Map<number, OutletJadwal[]>()
  for (const o of outlets) if (o.rayon) m.set(o.rayon, [...(m.get(o.rayon) || []), o])
  return m
}
// Outlet pada satu hari = gabungan outlet semua rayon hari itu, lalu disaring teks (nama, Outlet ID, alamat). Urut per rayon lalu nama.
export function outletHari(rayons: number[], per: Map<number, OutletJadwal[]>, q = '') {
  const k = q.trim().toLowerCase()
  const semua = [...rayons].sort((a, b) => a - b).flatMap(r => (per.get(r) || []).slice().sort((a, b) => a.name.localeCompare(b.name)))
  return { total: semua.length, tampil: k ? semua.filter(o => `${o.name} ${o.ext_id || ''} ${o.address}`.toLowerCase().includes(k)) : semua }
}

// Hasil rpc('jadwal_hari_ini') dibaca dengan hati-hati: bentuk yang tidak dikenal dianggap tidak ada jadwal (tidak mengunci siapa pun).
export function bacaJadwalHariIni(x: unknown): JadwalHariIni | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  const rayon = Array.isArray(o.rayon) ? o.rayon.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 24) : []
  const angka = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  return { locked: o.locked === true, minggu: angka(o.minggu), hari: angka(o.hari), rayon }
}

// ---- Tanggal teks YYYY-MM-DD (tanpa zona waktu; dihitung di UTC agar tidak bergeser) ----
const ms = (t: string) => Date.parse(`${t}T00:00:00Z`)
const teks = (n: number) => new Date(n).toISOString().slice(0, 10)
export const tambahHari = (t: string, n: number) => teks(ms(t) + n * 864e5)
export const adalahSenin = (t: string) => /^\d{4}-\d{2}-\d{2}$/.test(t) && !Number.isNaN(ms(t)) && teks(ms(t)) === t && new Date(ms(t)).getUTCDay() === 1
export const seninDari = (t: string) => { const d = new Date(ms(t)).getUTCDay(); return tambahHari(t, -((d + 6) % 7)) }   // Senin pada minggu tanggal itu
export const hariIniDi = (tz: string, now = new Date()) => now.toLocaleDateString('sv-SE', { timeZone: tz })
export const tanggalPanjang = (t: string) => new Date(ms(t)).toLocaleDateString('id-ID', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })
