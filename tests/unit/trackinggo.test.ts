import { test } from 'node:test'
import assert from 'node:assert/strict'
import { susunRute, ringkasOutlet, formatDurasi, formatJarak, tglIndo, tglIndoDari, batasWaktu, hariAntara, jarakM, namaFile, INDIKATOR, type KunjunganRow, type KonfirmasiRow } from '../../lib/trackinggo'
import { OTJ_TEMPLATES, flattenItems, butirBagian, skorPersen, skorTotal, skorButir } from '../../lib/otj-template'
import { buatXlsxBacktrack, buatXlsxOtj, type BarisBacktrack } from '../../lib/trackinggo-excel'
import { bacaXlsx } from '../../lib/excel'

const outlet = (name: string, extra: Partial<NonNullable<KunjunganRow['outlets']>> = {}) => ({ code: '0300-0000001', name, address: 'Jl. A', lat: -6.2, long: 106.9, created_at: '2025-07-05T11:17:21Z', ...extra })
const kunj = (id: string, outletId: number, inn: string, out: string | null, o = outlet('Toko ' + outletId), sales: KunjunganRow['sales'] = []): KunjunganRow =>
  ({ id, outlet_id: outletId, checkin_at: inn, checkout_at: out, cabang_id: 'c1', cabang: { tz: 'Asia/Jakarta' }, outlets: o, sales })
const jual = (produk: string, qty: number, value: number) => ({ qty, price: value / qty, value, products: { product: produk } })
const ind = (status: 'Sesuai' | 'TS' | 'N/A' | '' = 'Sesuai', keterangan = '') => ({ status, keterangan })
const konf = (visitId: string | null): KonfirmasiRow => ({
  id: 'k-' + visitId, visit_id: visitId, cabang_id: 'c1', frontliner_id: 'f1', frontliner_user_id: '0300-TMTB01', frontliner_nama: 'Andi', outlet_id: 1, outlet_kode: 'x', outlet_nama: 'Toko 1',
  visit_date: '2026-09-29', checkin_at: null, toko_ada: true, penjualan_sesuai: true, jam_kunjungan: ind('N/A'), on_rayon: ind(), kunjungan_manual: ind(), pv_satu: ind(), temuan_lain: '', hasil_diskusi: '',
  jarak_m: 12, oleh_user_id: 'MDS01', oleh_nama: 'MDS', oleh_role: 'mds', created_at: '2026-09-29T10:00:00Z' })

test('rute: diurutkan jam check-in, durasi dan jeda dihitung dari waktu sungguhan', () => {
  const rute = susunRute([
    kunj('b', 2, '2026-09-29T03:00:00Z', '2026-09-29T03:20:00Z'),
    kunj('a', 1, '2026-09-29T01:00:00Z', '2026-09-29T01:10:30Z', outlet('Toko 1'), [jual('P1', 2, 6000)]),
    kunj('c', 3, '2026-09-29T04:00:00Z', null),
  ], [])
  assert.deepEqual(rute.map(s => s.visitId), ['a', 'b', 'c'])
  assert.equal(rute[0].pertama, true); assert.equal(rute[1].pertama, false)
  assert.equal(rute[0].durasiDtk, 630)
  assert.equal(rute[0].jedaDtk, null)                        // outlet pertama tidak punya pembanding
  assert.equal(rute[1].jedaDtk, 6570)                        // 01:10:30 -> 03:00:00 = 1 jam 49 mnt 30 dtk
  assert.equal(rute[2].durasiDtk, null)                      // belum check-out
  assert.equal(rute[2].jedaDtk, 2400)
  assert.equal(rute[0].total, 6000); assert.equal(rute[0].items[0].produk, 'P1')
})

test('rute: check-out beda hari ditandai dan durasi tetap benar; tumpang tindih terdeteksi', () => {
  const [a, b] = susunRute([
    kunj('a', 1, '2026-09-29T15:00:00Z', '2026-09-29T18:00:00Z'),   // check-out 01:00 WIB hari berikutnya
    kunj('b', 2, '2026-09-29T16:00:00Z', '2026-09-29T16:30:00Z'),   // check-in sebelum check-out outlet sebelumnya
  ], [])
  assert.equal(a.checkoutBedaHari, true); assert.equal(a.durasiDtk, 10800)
  assert.equal(b.checkoutBedaHari, false)
  assert.equal(b.jedaDtk, -7200); assert.equal(b.tumpangTindih, true)
})

test('rute: konfirmasi dicocokkan per kunjungan (bukan per outlet); outlet yang sama dua kali tidak tertukar', () => {
  const rute = susunRute([kunj('a', 1, '2026-09-29T01:00:00Z', '2026-09-29T01:10:00Z'), kunj('b', 1, '2026-09-29T05:00:00Z', '2026-09-29T05:10:00Z')], [konf('b'), konf(null)])
  assert.equal(rute[0].konfirmasi, null); assert.equal(rute[1].konfirmasi?.visit_id, 'b')
})

test('rute: outlet tanpa data memakai ID sebagai nama cadangan', () => {
  const [s] = susunRute([{ ...kunj('a', 77, '2026-09-29T01:00:00Z', null), outlets: null }], [])
  assert.equal(s.nama, 'Outlet 77'); assert.equal(s.kode, '77'); assert.equal(s.lat, null)
})

test('ringkasan: satu baris per outlet, jumlah kunjungan dan total penjualan', () => {
  const r = ringkasOutlet([
    kunj('a', 1, '2026-09-29T01:00:00Z', null, outlet('Toko Z'), [jual('P', 1, 1000), jual('Q', 1, 2500)]),
    kunj('b', 1, '2026-09-30T01:00:00Z', null, outlet('Toko Z'), [jual('P', 3, 3000)]),
    kunj('c', 2, '2026-09-30T02:00:00Z', null, outlet('Toko A')),
  ])
  assert.deepEqual(r.map(x => [x.nama, x.kunjungan, x.total]), [['Toko A', 1, 0], ['Toko Z', 2, 6500]])
})

test('format durasi, jarak, tanggal', () => {
  assert.equal(formatDurasi(47), '47 dtk'); assert.equal(formatDurasi(287), '4 mnt 47 dtk'); assert.equal(formatDurasi(1500), '25 mnt')
  assert.equal(formatDurasi(3900), '1 jam 5 mnt'); assert.equal(formatDurasi(7200), '2 jam'); assert.equal(formatDurasi(-120), '2 mnt'); assert.equal(formatDurasi(null), '-')
  assert.equal(formatJarak(85.4), '85 m'); assert.equal(formatJarak(1450), '1.4 km')
  assert.equal(tglIndo('2026-09-11'), '11 September 2026'); assert.equal(tglIndo('bukan tanggal'), 'bukan tanggal')
  assert.equal(tglIndoDari('2025-07-05T18:30:00Z'), '6 Juli 2025')   // 18:30 UTC = 01:30 WIB hari berikutnya
  assert.equal(namaFile('Andi / Budi'), 'Andi_Budi')
})

test('rentang waktu mengikuti zona cabang dan mencakup seluruh hari terakhir', () => {
  const { a, b } = batasWaktu('2026-09-29', '2026-09-30', '+07:00')
  assert.equal(a, '2026-09-29T00:00:00+07:00'); assert.equal(b, '2026-09-30T17:00:00.000Z')   // awal 1 Okt WIB
  assert.equal(hariAntara('2026-09-29', '2026-09-29'), 1); assert.equal(hariAntara('2026-09-01', '2026-09-30'), 30)
})

test('jarak Haversine cocok dengan rumus di database (sekitar 111 km per derajat lintang)', () => {
  assert.equal(Math.round(jarakM(-6.2, 106.9, -6.2, 106.9)), 0)
  assert.ok(Math.abs(jarakM(0, 0, 1, 0) - 111195) < 5)
  assert.ok(Math.abs(jarakM(-6.2, 106.9, -6.2 + 60 / 111195, 106.9) - 60) < 0.5)
})

test('OTJ: id butir stabil dan jumlah butir sesuai template resmi', () => {
  const tf = OTJ_TEMPLATES.Taskforce, md = OTJ_TEMPLATES['MD GT']
  assert.deepEqual([butirBagian(tf, 'pra').length, butirBagian(tf, 'kunjungan').length, butirBagian(tf, 'pasca').length], [7, 16, 3])
  assert.deepEqual([butirBagian(md, 'pra').length, butirBagian(md, 'kunjungan').length, butirBagian(md, 'pasca').length], [7, 18, 3])
  const ids = flattenItems(tf).map(i => i.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.equal(ids[0], 'pra-0-0'); assert.ok(ids.includes('kunjungan-3-4'))
  assert.equal(flattenItems(tf).find(i => i.id === 'kunjungan-3-4')?.label, 'Apakah Taskforce berhasil melakukan penjualan?')
})

test('OTJ: skor = Ya / (terjawab - N/A); N/A dan kosong tidak dihitung', () => {
  assert.equal(skorPersen(['Ya', 'Ya', 'Tidak', 'N/A', undefined, '']), 67)
  assert.equal(skorPersen(['N/A', 'N/A']), null); assert.equal(skorPersen([]), null)
  const t = OTJ_TEMPLATES.Taskforce, pra = butirBagian(t, 'pra'), kun = butirBagian(t, 'kunjungan'), pasca = butirBagian(t, 'pasca')
  const semuaYa = (b: typeof pra) => Object.fromEntries(b.map(i => [i.id, 'Ya']))
  assert.equal(skorButir(pra, semuaYa(pra)), 100)
  // 7 Ya (A) + toko 1: 16 Ya + toko 2: 16 Tidak + 3 Ya (C) -> 26 Ya dari 42 = 62%
  const nilai = skorTotal(t, semuaYa(pra), [{ jawaban: semuaYa(kun) }, { jawaban: Object.fromEntries(kun.map(i => [i.id, 'Tidak'])) }], semuaYa(pasca))
  assert.equal(nilai, 62)
})

test('Excel Back Tracking: terbaca kembali dengan isi yang benar', async () => {
  const rows: BarisBacktrack[] = [{ kodePelanggan: '0300-0000001', namaPelanggan: 'Toko 1', temuanLain: 'ada temuan', hasilDiskusi: 'sudah didiskusikan',
    jam_kunjungan: { status: 'Sesuai', keterangan: 'normal' }, on_rayon: { status: 'TS', keterangan: 'beda alasan' }, kunjungan_manual: { status: 'N/A', keterangan: '' }, pv_satu: { status: 'Sesuai', keterangan: '' } }]
  const buf = await buatXlsxBacktrack({ namaPelaksana: 'MDS Satu', tanggalPelaksanaan: '30 September 2026', namaSalesman: 'Andi', tanggalDKS: '29 September 2026', tindaklanjut: 'Pembinaan' }, rows)
  const [sheet] = await bacaXlsx(buf), teks = sheet.baris.flat().map(x => String(x ?? ''))
  assert.equal(sheet.nama, 'BACKTRACK 1')
  for (const harus of ['REPORT BACK TRACKING SALES', 'MDS Satu', 'Andi', '29 September 2026', 'Toko 1', 'beda alasan', 'ada temuan', 'Pembinaan', 'TS']) assert.ok(teks.includes(harus), harus)
  assert.ok(teks.some(x => x.includes(INDIKATOR[3].header)))
})

test('Excel Back Tracking: tanpa baris tetap menghasilkan file valid', async () => {
  const buf = await buatXlsxBacktrack({ namaPelaksana: '', tanggalPelaksanaan: '', namaSalesman: '', tanggalDKS: '', tindaklanjut: '' }, [])
  assert.equal((await bacaXlsx(buf))[0].nama, 'BACKTRACK 1')
})

test('Excel OTJ: skor tiap bagian dan isi toko benar', async () => {
  const t = OTJ_TEMPLATES['MD GT'], pra = butirBagian(t, 'pra'), kun = butirBagian(t, 'kunjungan'), pasca = butirBagian(t, 'pasca')
  const ya = (b: typeof pra) => Object.fromEntries(b.map(i => [i.id, 'Ya']))
  const { buffer, skorA, skorB, skorC } = await buatXlsxOtj(t, { tipe: 'MD GT', divisi: 'MOTORIS', frontliner: 'Andi', cabang: 'Pulogadung', tanggal: '2026-09-29', dinilaiOleh: 'MDS Satu', skor: 75,
    jawabanPra: ya(pra), jawabanPasca: { [pasca[0].id]: 'Tidak', [pasca[1].id]: 'Ya' },
    kunjungan: [{ outletNama: 'Toko Satu', jawaban: ya(kun) }, { outletNama: 'Toko Dua', jawaban: { [kun[0].id]: 'Tidak' } }],
    akarMasalah: { pra: '', kunjungan: 'kurang display', pasca: '' }, actionPlan: { pra: '', kunjungan: 'pasang planogram', pasca: '' } })
  assert.equal(skorA, 100); assert.equal(skorC, 50); assert.equal(skorB, 95)   // 18 "Ya" dari 19 jawaban (toko 2 hanya menjawab satu butir: Tidak)
  const teks = (await bacaXlsx(buffer))[0].baris.flat().map(x => String(x ?? ''))
  for (const harus of ['On-the-Job Assessment - MD GT', 'Andi', 'Pulogadung', 'MOTORIS', 'MDS Satu', '75%', 'Toko Satu', 'Toko Dua', 'kurang display', 'pasang planogram']) assert.ok(teks.includes(harus), harus)
})
