export const TZ = 'Asia/Jakarta'
// Zona waktu mengikuti cabang (WIB/WITA/WIT). Tanpa argumen = WIB.
export const OFFSET: Record<string, string> = { 'Asia/Jakarta': '+07:00', 'Asia/Makassar': '+08:00', 'Asia/Jayapura': '+09:00' }
export const day = (d: string | Date, tz = TZ) => new Date(d).toLocaleDateString('sv-SE', { timeZone: tz })
export const jam = (d: string | Date, tz = TZ) => new Date(d).toLocaleTimeString('sv-SE', { timeZone: tz })
export const hari = (d: string | Date, tz = TZ) => new Date(d).toLocaleDateString('en-US', { timeZone: tz, weekday: 'long' })
export const dt = (d: string | Date, tz = TZ) => `${day(d, tz)} ${jam(d, tz)}`
// Awal hari (00:00) di zona itu, n hari lalu, sebagai teks ISO yang dipahami database.
export const startOfDay = (tz = TZ, daysAgo = 0) => `${day(new Date(Date.now() - daysAgo * 864e5), tz)}T00:00:00${OFFSET[tz] || '+07:00'}`
export const dur = (a: string, b: string | null) => { if (!b) return ''; const s = Math.max(0, Math.round((+new Date(b) - +new Date(a)) / 1000)); return `${Math.floor(s / 3600)}:${Math.floor((s % 3600) / 60)}:${s % 60}` }
export const rp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
export const VSEL = 'id,checkin_at,outlet_id,cabang(tz),outlets(name),sales(qty,value,is_focus,products(product))'

export async function fetchAll(make: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>) {
  let all: any[] = []
  for (let f = 0; ; f += 1000) { const { data, error } = await make(f, f + 999); if (error) throw error; all = all.concat(data || []); if (!data || data.length < 1000) break }
  return all
}

export type DayRekap = { value: number; oc: number; visits: number; prod: Record<string, { qty: number; value: number; focus: boolean; ec: number }>; outlets: { name: string; value: number }[] }

// OC = jumlah outlet yang bertransaksi. EC produk fokus = jumlah outlet yang membeli produk itu; qty = total pcs.
export function rekap(visits: any[]): Record<string, DayRekap> {
  const out: Record<string, DayRekap> = {}, oc: Record<string, Set<any>> = {}, ec: Record<string, Record<string, Set<any>>> = {}, ol: Record<string, Record<string, { name: string; value: number }>> = {}
  for (const v of visits) {
    const d = day(v.checkin_at, v.cabang?.tz || TZ); const r = (out[d] ||= { value: 0, oc: 0, visits: 0, prod: {}, outlets: [] })
    r.visits++
    for (const s of v.sales || []) {
      const p = s.products?.product || '-'; const q = (r.prod[p] ||= { qty: 0, value: 0, focus: !!s.is_focus, ec: 0 })
      q.qty += s.qty; q.value += Number(s.value); r.value += Number(s.value)
      ;(oc[d] ||= new Set()).add(v.outlet_id); ;((ec[d] ||= {})[p] ||= new Set()).add(v.outlet_id)
      const o = ((ol[d] ||= {})[v.outlet_id] ||= { name: v.outlets?.name || '-', value: 0 }); o.value += Number(s.value)
    }
  }
  for (const d in out) {
    out[d].oc = oc[d]?.size || 0
    for (const p in out[d].prod) out[d].prod[p].ec = ec[d]?.[p]?.size || 0
    out[d].outlets = Object.values(ol[d] || {}).sort((a, b) => b.value - a.value)
  }
  return out
}

// Rupiah ringkas untuk grafik dan kartu: Rp 850 rb, Rp 1,2 jt, Rp 3,4 M
export const rpk = (n: number) => {
  const a = Math.abs(n), f = (x: number) => x.toFixed(1).replace('.', ',')
  if (a >= 1e9) return `Rp ${f(n / 1e9)} M`
  if (a >= 1e6) return `Rp ${f(n / 1e6)} jt`
  if (a >= 1e3) return `Rp ${Math.round(n / 1e3)} rb`
  return `Rp ${Math.round(n)}`
}
