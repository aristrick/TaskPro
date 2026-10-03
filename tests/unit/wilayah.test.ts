import { test } from 'node:test'
import assert from 'node:assert/strict'
import { petakan } from '../../lib/petakan'
import { kanon } from '../../lib/wilayah'

const prov = (j: any) => petakan(j).province_name

test('Provinsi ditemukan dari berbagai bentuk jawaban layanan peta', () => {
  assert.equal(prov({ address: { state: 'Daerah Khusus Ibukota Jakarta' } }), 'DKI Jakarta')                           // kolom state
  assert.equal(prov({ address: { 'ISO3166-2-lvl4': 'ID-JK' } }), 'DKI Jakarta')                                         // kode ISO
  assert.equal(prov({ address: {}, display_name: 'Jalan A, Cakung, Jakarta Timur, Daerah Khusus Ibukota Jakarta, 13910, Indonesia' }), 'DKI Jakarta')
  assert.equal(prov({ address: { city: 'Kota Bekasi' } }), 'Jawa Barat')                                                // petunjuk kota
  assert.equal(prov({ address: { state: 'Daerah Istimewa Yogyakarta' } }), 'DI Yogyakarta')
  assert.equal(prov({ address: { 'ISO3166-2-lvl4': 'ID-PD' } }), 'Papua Barat Daya')                                    // bukan "Papua"
  assert.equal(prov({ address: { state: 'Banten' } }), 'Banten')
})

test('tanpa petunjuk apa pun hasilnya kosong, bukan tebakan', () => {
  assert.equal(prov({ address: { road: 'Jl X' }, display_name: 'Jalan X, Indonesia' }), null)
  assert.equal(kanon('Negara Antah Berantah'), null)
})

test('alamat disusun dari jalan, kelurahan, kecamatan, kota', () => {
  const r = petakan({ address: { road: 'Jl. Melati', village: 'Cakung Barat', suburb: 'Cakung', city: 'Kota Administrasi Jakarta Timur', state: 'DKI Jakarta' } })
  assert.equal(r.village, 'Cakung Barat'); assert.equal(r.district, 'Cakung'); assert.equal(r.city_name, 'Kota Administrasi Jakarta Timur')
  assert.match(r.address, /Jl\. Melati, Cakung Barat, Cakung/)
})
