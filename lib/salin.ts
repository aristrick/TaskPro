// Salin teks ke papan klip. Memakai Clipboard API (butuh HTTPS); jika tidak tersedia atau ditolak, memakai cara lama lewat kolom teks sementara.
export async function salin(teks: string): Promise<boolean> {
  try { if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(teks); return true } } catch { /* lanjut ke cara lama */ }
  try {
    const sebelum = document.activeElement as HTMLElement | null
    const t = document.createElement('textarea')
    t.value = teks; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
    document.body.appendChild(t); t.select(); t.setSelectionRange(0, teks.length)
    const ok = document.execCommand('copy'); t.remove(); sebelum?.focus?.()
    return ok
  } catch { return false }
}

export type BarisSalin = { kunci: 'nama' | 'alamat' | 'kecamatan' | 'kelurahan'; label: string; nilai: string }

const rapi = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v)).replace(/\s+/g, ' ').trim()

// Data outlet yang bisa disalin untuk mengisi aplikasi kantor secara manual. Nilai kosong tetap ditampilkan (nilai '') agar petugas tahu datanya belum ada.
export function barisSalin(o: { name?: unknown; address?: unknown; district?: unknown; village?: unknown }): BarisSalin[] {
  return [
    { kunci: 'nama', label: 'Nama outlet', nilai: rapi(o.name) },
    { kunci: 'alamat', label: 'Alamat', nilai: rapi(o.address) },
    { kunci: 'kecamatan', label: 'Kecamatan', nilai: rapi(o.district) },
    { kunci: 'kelurahan', label: 'Kelurahan', nilai: rapi(o.village) },
  ]
}
