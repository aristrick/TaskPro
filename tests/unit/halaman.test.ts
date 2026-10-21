import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ProjectCard from '../../components/project/ProjectCard'
import AkunCard, { type Cabang } from '../../components/mds/AkunCard'

const noop = () => {}
const prods = [{ id: 'a', product: 'BONTEH MATCHA' }, { id: 'b', product: 'BONTEH TEH TARIK' }, { id: 'c', product: 'SAYANG LIQUID 20ML' }]
const kartu = (o: Partial<Parameters<typeof ProjectCard>[0]> = {}) => renderToStaticMarkup(h(ProjectCard, {
  p: { id: 'p1', name: 'TASKFORCE BONTEH SUNTER' }, anggota: [{ id: 'f1', user_id: '0100-TMTB01', nama: 'Marianah', project_id: 'p1' }],
  lainnya: [{ id: 'f2', user_id: '0100-TMTB02', nama: 'Budi', project_id: 'p2' }], fokus: ['a', 'b'], prods, sumber: [{ id: 'p2', name: 'PROJECT LAIN' }],
  namaProject: id => (id === 'p2' ? 'PROJECT LAIN' : undefined), onGanti: noop, onHapus: noop, onAnggota: noop, onTambahFokus: noop, onLepasFokus: noop, onSalin: noop, ...o }))

test('kartu project: ringkasan, dua bagian berjudul, dan tombol keluarkan/lepas yang bisa diakses keyboard', () => {
  const html = kartu()
  assert.match(html, /1 frontliner · 2 produk fokus/); assert.match(html, /Frontliner <span class="cnt">1/); assert.match(html, /Produk fokus <span class="cnt">2/)
  assert.match(html, /aria-label="Keluarkan Marianah dari project"/); assert.match(html, /aria-label="Lepas BONTEH MATCHA dari fokus"/)
  assert.match(html, /<button type="button" class="lrow-act"/); assert.doesNotMatch(html, /<a /)           // bukan tautan tanpa href lagi
  assert.match(html, /Ganti nama/); assert.match(html, /Hapus/); assert.match(html, /\(dari PROJECT LAIN\)/)
  assert.equal((html.match(/class="lrow"/g) || []).length, 3)   // 1 frontliner + 2 produk fokus: semua baris memakai kelas yang sama (ukuran seragam)
  assert.doesNotMatch(html, /SAYANG LIQUID 20ML<\/b>/); assert.match(html, /<option value="c">SAYANG LIQUID 20ML/)   // yang sudah fokus tidak muncul lagi di pilihan
})

test('kartu project kosong: keadaan kosong yang menjelaskan, bukan ruang hampa', () => {
  const html = kartu({ anggota: [], fokus: [], sumber: [] })
  assert.match(html, /Belum ada frontliner di project ini/); assert.match(html, /Belum ada produk fokus/); assert.doesNotMatch(html, /Salin dari project lain/)
})

const cabang: Cabang[] = [{ id: 'c1', kode: '0300', nama: 'Pulogadung', mds_id: 'm1', rmdm_id: 'r1' }, { id: 'c2', kode: '0100', nama: 'Sunter', mds_id: null, rmdm_id: 'r1' }]
test('kartu akun: tombol berisiko ada di kaki kartu, terpisah dari nama (tidak saling menimpa)', () => {
  const html = renderToStaticMarkup(h(AkunCard, { m: { id: 'r1', user_id: 'JBK31.MDGT', nama: 'Agus Ruchmantaya', role: 'rmdm' }, cabang, bebasMds: [], bebasR: [], viewerRole: 'mdm', status: h('span', null, 'STATUS'), bisaPaksa: true, onHapus: noop, onPaksa: noop, onOp: noop }))
  const header = html.slice(html.indexOf('<header'), html.indexOf('</header>')), foot = html.slice(html.indexOf('<footer'))
  assert.match(header, /Agus Ruchmantaya/); assert.match(header, /STATUS/); assert.doesNotMatch(header, /Logout paksa|Hapus/)
  assert.match(foot, /Logout paksa/); assert.match(foot, /Hapus/)
})

test('kartu akun MDS: Lepas cabang sejajar dengan Hapus di kaki kartu; pilihan pindah punya label jelas', () => {
  const html = renderToStaticMarkup(h(AkunCard, { m: { id: 'm1', user_id: 'PULOGADUNG.MDGT', nama: 'Aris', role: 'mds' }, cabang, bebasMds: [cabang[1]], bebasR: [], viewerRole: 'mdm', status: null, bisaPaksa: false, onHapus: noop, onPaksa: noop, onOp: noop }))
  const foot = html.slice(html.indexOf('<footer')), body = html.slice(0, html.indexOf('<footer'))
  assert.match(foot, /Lepas cabang/); assert.match(foot, /Hapus/); assert.doesNotMatch(body, /Lepas cabang/)
  assert.match(body, /<span class="label">Pindah ke cabang lain<\/span>/); assert.match(body, /Pilih cabang tujuan/)
})
test('kartu akun RMDM: cabang berupa daftar baris seragam dengan tombol Lepas di tiap baris', () => {
  const html = renderToStaticMarkup(h(AkunCard, { m: { id: 'r1', user_id: 'JBK31.MDGT', nama: 'Agus', role: 'rmdm' }, cabang, bebasMds: [], bebasR: [], viewerRole: 'mdm', status: null, bisaPaksa: false, onHapus: noop, onPaksa: noop, onOp: noop }))
  assert.equal((html.match(/class="lrow"/g) || []).length, 2); assert.equal((html.match(/class="lrow-act"/g) || []).length, 2); assert.match(html, /aria-label="Lepas 0300"/)
})
