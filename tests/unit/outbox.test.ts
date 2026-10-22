import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { antre, muat, hapus, adaUntuk, kirimSemua, galatJaringan, type Antrean, type Klien } from '../../lib/outbox'
import { simpanSnap, muatSnap, hapusSnap, type Snap } from '../../lib/snapshot'

const gudang = (): Storage => { const m = new Map<string, string>(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => void m.set(k, String(v)), removeItem: k => void m.delete(k), clear: () => m.clear(), key: i => [...m.keys()][i] ?? null, get length() { return m.size } } }
const item = (id: string, o: Partial<Antrean> = {}): Antrean => ({ visit_id: id, items: [{ product_id: 'p1', qty: 2 }], lat: -6.2, lng: 106.8, acc: 10, at: '2026-10-21T03:00:00.000Z', outlet: 'Warung A', dibuat: Date.now(), ...o })
type Balasan = { error: { message?: string; code?: string } | null }
const klien = (jawab: (fn: string, args: any, n: number) => Balasan | Promise<Balasan>) => { const log: { fn: string; args: any }[] = []; const k: Klien = { rpc: async (fn, args) => { log.push({ fn, args }); return jawab(fn, args, log.length) } }; return { k, log } }
const ok: Balasan = { error: null }
let g: Storage; beforeEach(() => { g = gudang() })

test('antrean: simpan, satu antrean per kunjungan, hapus, dan data rusak diabaikan', () => {
  antre(item('v1'), g); antre(item('v2'), g); antre(item('v1', { outlet: 'Baru' }), g)
  assert.equal(muat(g).length, 2); assert.equal(muat(g).find(x => x.visit_id === 'v1')!.outlet, 'Baru'); assert.ok(adaUntuk('v2', g))
  hapus('v1', g); hapus('v2', g); assert.equal(muat(g).length, 0); assert.equal(g.getItem('taskpro-outbox'), null)
  g.setItem('taskpro-outbox', '{rusak'); assert.deepEqual(muat(g), []); g.setItem('taskpro-outbox', '[1,{"x":1}]'); assert.deepEqual(muat(g), [])
})

test('deteksi gangguan jaringan', () => {
  for (const m of ['TypeError: Failed to fetch', 'NetworkError when attempting to fetch resource.', 'Load failed', '<html>Bad Gateway</html>', 'timeout of 15000ms exceeded']) assert.ok(galatJaringan({ message: m }), m)
  for (const m of ['Stok BONTEH tidak cukup.', 'Kunjungan tidak aktif.', 'Anda 120 m dari outlet']) assert.ok(!galatJaringan({ message: m }), m)
})

test('pengiriman sukses: save_sales lalu checkout_tertunda dengan waktu asli, antrean kosong', async () => {
  antre(item('v1'), g); const { k, log } = klien(() => ok)
  const h = await kirimSemua(k, g)
  assert.deepEqual(log.map(x => x.fn), ['save_sales', 'checkout_tertunda']); assert.deepEqual(log[1].args, { p_visit: 'v1', p_at: '2026-10-21T03:00:00.000Z' })
  assert.deepEqual(log[0].args, { p_visit: 'v1', p_items: [{ product_id: 'p1', qty: 2 }], p_lat: -6.2, p_lng: 106.8, p_acc: 10 })
  assert.equal(h.terkirim.length, 1); assert.equal(h.menunggu, 0); assert.equal(muat(g).length, 0)
})

test('tanpa penjualan: hanya checkout_tertunda', async () => {
  antre(item('v1', { items: [] }), g); const { k, log } = klien(() => ok); await kirimSemua(k, g); assert.deepEqual(log.map(x => x.fn), ['checkout_tertunda'])
})

test('jaringan putus: antrean tetap tersimpan, urutan terjaga, dan berhenti di kegagalan pertama', async () => {
  antre(item('lama', { dibuat: 1 }), g); antre(item('baru', { dibuat: 2 }), g)
  const { k, log } = klien(() => ({ error: { message: 'TypeError: Failed to fetch' } }))
  const h = await kirimSemua(k, g)
  assert.equal(h.menunggu, 2); assert.equal(h.terkirim.length, 0); assert.equal(muat(g).length, 2); assert.equal(log.length, 1); assert.equal(log[0].args.p_visit, 'lama')
})

test('pengiriman diulang aman: kunjungan sudah ditutup dianggap selesai (respons sebelumnya hilang di jalan)', async () => {
  antre(item('v1'), g); const { k } = klien(() => ({ error: { message: 'Kunjungan tidak aktif.' } }))
  const h = await kirimSemua(k, g); assert.equal(h.terkirim.length, 1); assert.equal(h.ditolak.length, 0); assert.equal(muat(g).length, 0)
})

test('migrasi 16 belum ada atau waktu ditolak: memakai checkout() biasa', async () => {
  for (const salah of [{ code: 'PGRST202', message: 'Could not find the function public.checkout_tertunda' }, { message: 'Waktu check-out tidak valid.' }, { message: 'Data tertunda lebih dari 48 jam.' }]) {
    antre(item('v1'), g); const { k, log } = klien(fn => (fn === 'checkout_tertunda' ? { error: salah } : ok))
    const h = await kirimSemua(k, g); assert.deepEqual(log.map(x => x.fn), ['save_sales', 'checkout_tertunda', 'checkout']); assert.equal(h.terkirim.length, 1); assert.equal(muat(g).length, 0)
  }
})

test('penolakan aturan bisnis (stok/radius): dikeluarkan dari antrean dan dilaporkan, antrean berikutnya tetap jalan', async () => {
  antre(item('a', { dibuat: 1, outlet: 'Toko A' }), g); antre(item('b', { dibuat: 2 }), g)
  const { k } = klien((fn, a) => (fn === 'save_sales' && a.p_visit === 'a' ? { error: { message: 'Stok BONTEH tidak cukup. Sisa 1 pcs, diminta 2 pcs.' } } : ok))
  const h = await kirimSemua(k, g)
  assert.equal(h.ditolak.length, 1); assert.equal(h.ditolak[0].item.outlet, 'Toko A'); assert.match(h.ditolak[0].pesan, /Stok BONTEH/); assert.equal(h.terkirim.length, 1); assert.equal(muat(g).length, 0)
})

test('dipanggil bersamaan: hanya satu proses pengiriman (tidak ada kirim ganda)', async () => {
  antre(item('v1'), g); const { k, log } = klien(async () => { await new Promise(r => setTimeout(r, 20)); return ok })
  const [a, b] = await Promise.all([kirimSemua(k, g), kirimSemua(k, g)])
  assert.equal(a, b); assert.equal(log.filter(x => x.fn === 'checkout_tertunda').length, 1)
})

test('salinan kunjungan: simpan, muat, kedaluwarsa 24 jam, dan milik akun lain tidak terbaca', () => {
  const s: Snap = { t: 1_000_000, me: { id: 'u1', user_id: '0300-TMTB01', nama: 'A', role: 'frontliner', cabang_id: 'c' }, visit: { id: 'v1', outlet_id: 1, checkin_at: 'x', project_id: null, outlets: null }, products: [], focus: ['p1'], minCo: 0, tz: 'Asia/Jakarta', stok: {}, stokOn: true }
  simpanSnap(s, g); assert.equal(muatSnap('u1', g, 1_000_000 + 3600e3)?.visit.id, 'v1')
  assert.equal(muatSnap('u1', g, 1_000_000 + 25 * 3600e3), null); assert.equal(muatSnap('u2', g, 1_000_000), null)
  hapusSnap('u1', g); assert.equal(muatSnap('u1', g, 1_000_000), null)
})
