import { barisStruk, escpos, rawbtUrl, type Baris, type Struk } from './escpos'

// Tiga cara mencetak ke printer portable. Tidak ada yang bisa mencakup semua perangkat:
//  bt     = Bluetooth langsung (Chrome/Edge/Samsung Internet; Android dan laptop; printer Bluetooth LE). Tidak tersedia di Safari iPhone.
//  rawbt  = Android + aplikasi RawBT (mendukung printer Bluetooth klasik, USB, jaringan).
//  system = dialog cetak bawaan browser (butuh printer yang terdaftar di sistem, mis. AirPrint di iPhone).
export type Metode = 'bt' | 'rawbt' | 'system'
export type Pref = { metode: Metode; lebar: 32 | 48; tanya: boolean; judul: string; footer: string; btNama: string }

const KUNCI = 'taskpro-printer', TERAKHIR = 'taskpro-struk-terakhir'
export const dukungBluetooth = () => typeof navigator !== 'undefined' && 'bluetooth' in navigator
export const adaAndroid = () => typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)
export const adaIOS = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)
export const metodeAwal = (): Metode => (dukungBluetooth() ? 'bt' : adaAndroid() ? 'rawbt' : 'system')
export const prefBawaan = (): Pref => ({ metode: metodeAwal(), lebar: 32, tanya: true, judul: 'STRUK PENJUALAN', footer: 'Terima kasih', btNama: '' })

export function muatPref(): Pref { try { return { ...prefBawaan(), ...JSON.parse(localStorage.getItem(KUNCI) || '{}') } } catch { return prefBawaan() } }
export function simpanPref(p: Pref) { try { localStorage.setItem(KUNCI, JSON.stringify(p)) } catch { /* abaikan */ } }
export function simpanTerakhir(s: Struk) { try { localStorage.setItem(TERAKHIR, JSON.stringify(s)) } catch { /* abaikan */ } }
export function muatTerakhir(): Struk | null { try { const x = localStorage.getItem(TERAKHIR); return x ? JSON.parse(x) : null } catch { return null } }

// ---------- Bluetooth langsung (Web Bluetooth) ----------
const LAYANAN = ['000018f0-0000-1000-8000-00805f9b34fb', '0000ff00-0000-1000-8000-00805f9b34fb', '0000ffe0-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', '0000fee7-0000-1000-8000-00805f9b34fb']
let dev: any = null, jalur: any = null
export const btTerpasang = () => !!dev

export async function pasangBt(): Promise<string> {
  const bt = (navigator as any).bluetooth
  if (!bt) throw new Error('Browser ini tidak mendukung Bluetooth langsung. Pakai RawBT (Android) atau dialog cetak sistem.')
  dev = await bt.requestDevice({ acceptAllDevices: true, optionalServices: LAYANAN }); jalur = null
  await sambungBt()
  return dev.name || 'Printer'
}
async function sambungBt() {
  if (!dev) throw new Error('Printer belum dipasangkan. Buka Profile > Printer & struk > Pasangkan printer.')
  if (jalur && dev.gatt?.connected) return jalur
  const server = await dev.gatt.connect()
  for (const sv of await server.getPrimaryServices()) {
    const w = (await sv.getCharacteristics()).find((c: any) => c.properties.write || c.properties.writeWithoutResponse)
    if (w) { jalur = w; return jalur }
  }
  throw new Error('Printer terhubung tetapi tidak punya jalur tulis yang dikenali. Printer ini kemungkinan Bluetooth klasik: pakai metode RawBT.')
}
// Potongan kecil (20 byte) agar kompatibel dengan hampir semua printer Bluetooth LE.
async function cetakBt(data: Uint8Array) {
  const c = await sambungBt()
  for (let i = 0; i < data.length; i += 20) {
    const bagian = data.slice(i, i + 20)
    if (c.properties.writeWithoutResponse && c.writeValueWithoutResponse) await c.writeValueWithoutResponse(bagian); else await c.writeValue(bagian)
    await new Promise(r => setTimeout(r, 25))
  }
}

// ---------- Dialog cetak sistem ----------
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
function cetakSistem(B: Baris[], lebar: number) {
  return new Promise<void>((ok, gagal) => {
    const mm = lebar === 32 ? 58 : 80, f = document.createElement('iframe')
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f)
    const d = f.contentWindow!.document; d.open()
    d.write(`<html><head><meta charset="utf-8"><style>@page{size:${mm}mm auto;margin:2mm}body{margin:0;font:12px/1.3 "Courier New",monospace}div{white-space:pre}</style></head><body>` +
      B.map(x => `<div style="text-align:${x.c ? 'center' : 'left'};font-weight:${x.b ? 700 : 400}">${esc(x.t) || '&nbsp;'}</div>`).join('') + '</body></html>'); d.close()
    setTimeout(() => { try { f.contentWindow!.focus(); f.contentWindow!.print(); ok() } catch (e) { gagal(e) } setTimeout(() => f.remove(), 4000) }, 200)
  })
}

export async function cetak(s: Struk, p: Pref) {
  const B = barisStruk(s, p.lebar)
  if (p.metode === 'bt') { if (!dev) await pasangBt(); return cetakBt(escpos(B)) }
  if (p.metode === 'rawbt') {
    if (!adaAndroid()) throw new Error('RawBT hanya untuk Android. Pilih metode lain di Profile > Printer & struk.')
    location.href = rawbtUrl(escpos(B)); return
  }
  return cetakSistem(B, p.lebar)
}
export const strukContoh = (p: Pref): Struk => ({ judul: p.judul, footer: p.footer, nomor: 'TES00001', waktu: new Date().toLocaleString('id-ID'), outlet: 'Warung Contoh', alamat: 'Jl. Contoh No. 1, Jakarta',
  frontliner: 'Nama Sales', userId: '0000-XXXX01', items: [{ nama: 'PRODUK CONTOH 100ML', qty: 2, harga: 8000 }, { nama: 'PRODUK LAIN', qty: 1, harga: 3300 }], total: 19300 })
