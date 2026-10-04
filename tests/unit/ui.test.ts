import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SettingRow, Switch } from '../../components/Switch'
import AkunCard, { inisial, type Cabang, type Akun } from '../../components/mds/AkunCard'
import { rpk } from '../../lib/rekap'

const noop = () => {}
const cabang: Cabang[] = [
  { id: 'c1', kode: '0300', nama: 'Pulogadung', mds_id: 'm1', rmdm_id: 'r1' },
  { id: 'c2', kode: '0100', nama: 'Sunter', mds_id: null, rmdm_id: 'r1' },
  { id: 'c3', kode: '0400', nama: 'Cakung', mds_id: null, rmdm_id: null },
]
const kartu = (m: Akun, viewerRole: string, bisaPaksa = false) => renderToStaticMarkup(h(AkunCard, {
  m, cabang, bebasMds: cabang.filter(c => !c.mds_id), bebasR: cabang.filter(c => !c.rmdm_id), viewerRole, status: h('span', null, 'STATUS'), bisaPaksa, onHapus: noop, onPaksa: noop, onOp: noop }))

test('rupiah ringkas', () => {
  assert.equal(rpk(0), 'Rp 0'); assert.equal(rpk(850000), 'Rp 850 rb'); assert.equal(rpk(1200000), 'Rp 1,2 jt'); assert.equal(rpk(2999850), 'Rp 3,0 jt'); assert.equal(rpk(3400000000), 'Rp 3,4 M')
})

test('saklar: sama di mana pun, bisa mati/nyala, dan terkunci bila tidak berhak', () => {
  const on = renderToStaticMarkup(h(Switch, { checked: true, onChange: noop, label: 'GPS' }))
  assert.match(on, /class="switch"/); assert.match(on, /role="switch"/); assert.match(on, /checked=""/)
  assert.match(renderToStaticMarkup(h(Switch, { checked: false, onChange: noop, label: 'GPS', disabled: true })), /disabled=""/)
})

test('baris pengaturan: MDM melihat saklar; peran lain melihat lencana status dan catatan', () => {
  const props = { icon: 'locate', title: 'Wajib dekat outlet', desc: 'Aktif: maksimal 50 m', checked: true as boolean | null, onChange: noop }
  const mdm = renderToStaticMarkup(h(SettingRow, { ...props, canEdit: true }))
  assert.match(mdm, /role="switch"/); assert.match(mdm, /Aktif: maksimal 50 m/); assert.doesNotMatch(mdm, /Hanya MDM/)
  const lain = renderToStaticMarkup(h(SettingRow, { ...props, canEdit: false }))
  assert.doesNotMatch(lain, /role="switch"/); assert.match(lain, /on-badge/); assert.match(lain, /Hanya MDM yang dapat mengubah/)
  assert.match(renderToStaticMarkup(h(SettingRow, { ...props, canEdit: false, checked: false })), /off-badge/)
  const memuat = renderToStaticMarkup(h(SettingRow, { ...props, canEdit: true, checked: null }))
  assert.doesNotMatch(memuat, /role="switch"/); assert.match(memuat, /skel/)
})

test('kartu MDS: cabang, lepas/pindah, dan keadaan tanpa cabang', () => {
  const ada = kartu({ id: 'm1', user_id: 'PULOGADUNG.MDGT', nama: 'Aris Setiawan Romadhoni', role: 'mds' }, 'mdm', true)
  assert.match(ada, /0300 Pulogadung/); assert.match(ada, /Lepas cabang/); assert.match(ada, /Pindah ke cabang/); assert.match(ada, /Hapus/); assert.match(ada, /Logout paksa/); assert.match(ada, /STATUS/); assert.match(ada, />AS</)
  const tanpa = kartu({ id: 'm9', user_id: 'X', nama: 'Baru', role: 'mds' }, 'mdm')
  assert.match(tanpa, /Belum punya cabang/); assert.doesNotMatch(tanpa, /Lepas cabang/); assert.match(tanpa, /Pilih cabang/); assert.doesNotMatch(tanpa, /Logout paksa/)
})

test('kartu RMDM: hanya MDM yang boleh mengatur cakupan', () => {
  const rm: Akun = { id: 'r1', user_id: 'JBK31.MDGT', nama: 'Agus', role: 'rmdm' }
  const oleh_mdm = kartu(rm, 'mdm')
  assert.match(oleh_mdm, /Cabang yang dicover \(2\)/); assert.match(oleh_mdm, /Lepas 0300/); assert.match(oleh_mdm, /Tambah cabang yang dicover/)
  const oleh_rmdm = kartu(rm, 'rmdm')
  assert.doesNotMatch(oleh_rmdm, /Lepas 0300/); assert.match(oleh_rmdm, /Hanya MDM yang bisa mengatur cakupan RMDM/)
})

test('kartu MDM: tanpa tombol Hapus, nama disingkat jadi inisial', () => {
  const mdm = kartu({ id: 'x', user_id: 'MDM01', nama: 'MDM Utama', role: 'mdm' }, 'mdm', true)
  assert.doesNotMatch(mdm, /Hapus/); assert.match(mdm, /Logout paksa/)
  assert.equal(inisial('Resa Nova Nanda'), 'RN'); assert.equal(inisial('  '), '?'); assert.equal(inisial('Budi'), 'B')
})
