import { NextResponse } from 'next/server'
import { caller, fail, handler, Ctx } from '../../../lib/server'

// MDM/RMDM boleh membuat/menghapus MDS. Hanya MDM yang boleh membuat/menghapus RMDM dan mengatur cakupan RMDM.
// Aturan: 1 MDS = 1 cabang (wajib saat dibuat). 1 RMDM = banyak cabang.
// Huruf, angka, titik, - dan _ (contoh: SUNTER.MDGT, 0300-MDS01). Titik tidak boleh di ujung atau berurutan (syarat email).
const ID_OK = (u: string) => /^[A-Z0-9][A-Z0-9._-]{2,29}$/.test(u) && !u.endsWith('.') && !u.includes('..')
async function guard(req: any) { const c = await caller(req); return c && ['mdm', 'rmdm'].includes(c.role) ? c : null }
async function cabangBoleh(c: Ctx, cabangId: string) {   // RMDM hanya untuk cabang yang dicovernya
  if (c.role === 'mdm') return true
  const { data } = await c.db.from('cabang').select('id').eq('id', cabangId).eq('rmdm_id', c.uid).maybeSingle()
  return !!data
}

export const POST = handler(async req => {
  const c = await guard(req); if (!c) return fail('Tidak diizinkan', 403)
  const { user_id, nama, password, role = 'mds', cabang_id } = await req.json()
  if (!user_id || !nama || !password) return fail('Semua kolom wajib diisi')
  if (!['mds', 'rmdm'].includes(role)) return fail('Role tidak valid')
  if (role === 'rmdm' && c.role !== 'mdm') return fail('Hanya MDM yang boleh membuat RMDM', 403)
  const uid = String(user_id).trim().toUpperCase()
  if (!ID_OK(uid)) return fail('User ID hanya boleh huruf, angka, titik, - dan _ (3–30 karakter, tidak diawali/diakhiri titik)')
  if (String(password).length < 6) return fail('Password minimal 6 karakter')

  if (role === 'mds') {   // cabang wajib dan harus masih kosong
    if (!cabang_id) return fail('Pilih 1 cabang untuk MDS ini')
    const { data: cb } = await c.db.from('cabang').select('id,kode,nama,mds_id').eq('id', cabang_id).maybeSingle()
    if (!cb) return fail('Cabang tidak ditemukan')
    if (cb.mds_id) return fail(`Cabang ${cb.kode} ${cb.nama} sudah punya MDS`)
    if (!(await cabangBoleh(c, cabang_id))) return fail('Cabang ini bukan wewenang Anda', 403)
  }

  const { data, error } = await c.db.auth.admin.createUser({ email: uid.toLowerCase() + '@taskpro.app', password, email_confirm: true })
  if (error) return fail(/already|registered|exists/i.test(error.message) ? 'User ID sudah dipakai' : error.message)
  const rollback = () => c.db.auth.admin.deleteUser(data.user.id)
  const { error: e2 } = await c.db.from('profiles').insert({ id: data.user.id, user_id: uid, nama: String(nama).trim(), role })
  if (e2) { await rollback(); return fail(/duplicate|unique/i.test(e2.message) ? 'User ID sudah dipakai' : e2.message) }
  if (role === 'mds') {
    const { data: got, error: e3 } = await c.db.from('cabang').update({ mds_id: data.user.id }).eq('id', cabang_id).is('mds_id', null).select('id')
    if (e3 || !got?.length) { await rollback(); return fail(e3?.message || 'Cabang baru saja diambil MDS lain. Pilih cabang lain.') }
  }
  return NextResponse.json({ ok: true })
})

// op: 'mds_cabang' (pindah/lepas cabang MDS) | 'rmdm_add' | 'rmdm_remove' (cakupan RMDM, hanya MDM)
export const PATCH = handler(async req => {
  const c = await guard(req); if (!c) return fail('Tidak diizinkan', 403)
  const { id, op, cabang_id } = await req.json()
  const { data: t } = await c.db.from('profiles').select('role').eq('id', id).maybeSingle()
  if (!t) return fail('Akun tidak ditemukan')

  if (op === 'mds_cabang') {
    if (t.role !== 'mds') return fail('Bukan akun MDS')
    const { data: lama } = await c.db.from('cabang').select('id').eq('mds_id', id).maybeSingle()
    if (lama && !(await cabangBoleh(c, lama.id))) return fail('Cabang MDS saat ini bukan wewenang Anda', 403)
    if (cabang_id) {
      const { data: cb } = await c.db.from('cabang').select('id,kode,nama,mds_id').eq('id', cabang_id).maybeSingle()
      if (!cb) return fail('Cabang tidak ditemukan')
      if (cb.mds_id && cb.mds_id !== id) return fail(`Cabang ${cb.kode} ${cb.nama} sudah punya MDS`)
      if (!(await cabangBoleh(c, cabang_id))) return fail('Cabang ini bukan wewenang Anda', 403)
    }
    await c.db.from('cabang').update({ mds_id: null }).eq('mds_id', id)          // 1 MDS = 1 cabang: lepas dulu yang lama
    if (cabang_id) {
      const { data: got, error } = await c.db.from('cabang').update({ mds_id: id }).eq('id', cabang_id).is('mds_id', null).select('id')
      if (error || !got?.length) {
        if (lama) await c.db.from('cabang').update({ mds_id: id }).eq('id', lama.id)   // kembalikan
        return fail(error?.message || 'Cabang baru saja diambil MDS lain')
      }
    }
    return NextResponse.json({ ok: true })
  }

  if (op === 'rmdm_add' || op === 'rmdm_remove') {
    if (c.role !== 'mdm') return fail('Hanya MDM yang bisa mengatur cakupan RMDM', 403)
    if (t.role !== 'rmdm' || !cabang_id) return fail('Permintaan tidak valid')
    if (op === 'rmdm_add') {
      const { data: got, error } = await c.db.from('cabang').update({ rmdm_id: id }).eq('id', cabang_id).is('rmdm_id', null).select('id')
      if (error || !got?.length) return fail(error?.message || 'Cabang ini sudah dicover RMDM lain')
    } else {
      const { error } = await c.db.from('cabang').update({ rmdm_id: null }).eq('id', cabang_id).eq('rmdm_id', id)
      if (error) return fail(error.message)
    }
    return NextResponse.json({ ok: true })
  }
  return fail('Operasi tidak dikenal')
})

export const DELETE = handler(async req => {
  const c = await guard(req); if (!c) return fail('Tidak diizinkan', 403)
  const { id } = await req.json()
  const { data: t } = await c.db.from('profiles').select('role').eq('id', id).maybeSingle()
  if (!t || !['mds', 'rmdm'].includes(t.role)) return fail('Bukan akun MDS/RMDM')
  if (t.role === 'rmdm' && c.role !== 'mdm') return fail('Hanya MDM yang boleh menghapus RMDM', 403)
  if (t.role === 'mds' && c.role === 'rmdm') {
    const { data: cb } = await c.db.from('cabang').select('id').eq('mds_id', id).maybeSingle()
    if (cb && !(await cabangBoleh(c, cb.id))) return fail('MDS ini bukan wewenang Anda', 403)
  }
  const { error } = await c.db.auth.admin.deleteUser(id) // cabang.mds_id / rmdm_id otomatis kosong
  return error ? fail(error.message) : NextResponse.json({ ok: true })
})
