import { NextResponse } from 'next/server'
import { caller as who, fail, handler, audit, Ctx } from '../../../lib/server'

const ROLES = ['tl', 'kormot', 'frontliner']
// MDM: semua cabang. MDS/RMDM: hanya cabang yang dipegang/dicovernya.
async function bolehCabang(c: Ctx, cabangId: string) {
  if (c.role === 'mdm') return true
  const col = c.role === 'mds' ? 'mds_id' : c.role === 'rmdm' ? 'rmdm_id' : null
  if (!col) return false
  const { data } = await c.db.from('cabang').select('id').eq('id', cabangId).eq(col, c.uid).maybeSingle()
  return !!data
}
async function atasanOk(c: Ctx, atasanId: string, cabangId: string) {
  const { data: a } = await c.db.from('profiles').select('role,cabang_id').eq('id', atasanId || '').maybeSingle()
  return !!a && ['tl', 'kormot'].includes(a.role) && a.cabang_id === cabangId
}

export const POST = handler(async req => {
  const c = await who(req); if (!c) return fail('Tidak diizinkan', 403)
  const { user_id, nama, password, role, cabang_id, atasan_id } = await req.json()
  if (!user_id || !nama || !password || !cabang_id || !ROLES.includes(role)) return fail('Semua kolom wajib diisi')
  if (String(password).length < 6) return fail('Password minimal 6 karakter')
  if (!(await bolehCabang(c, cabang_id))) return fail('Cabang ini bukan wewenang Anda', 403)
  const { data: cb } = await c.db.from('cabang').select('kode').eq('id', cabang_id).single()
  const uid = String(user_id).trim().toUpperCase()
  if (!cb || !uid.startsWith(cb.kode + '-')) return fail(`User ID harus diawali ${cb?.kode}- (kode cabang)`)
  if (role === 'frontliner' && !(await atasanOk(c, atasan_id, cabang_id))) return fail('Atasan harus TL/Kormot di cabang yang sama')
  const { data, error } = await c.db.auth.admin.createUser({ email: uid.toLowerCase() + '@taskpro.app', password, email_confirm: true })
  if (error) return fail(/already|registered|exists/i.test(error.message) ? 'User ID sudah dipakai' : error.message)
  const { error: e2 } = await c.db.from('profiles').insert({
    id: data.user.id, user_id: uid, nama, role, cabang_id, atasan_id: role === 'frontliner' ? atasan_id : null })
  if (e2) { await c.db.auth.admin.deleteUser(data.user.id); return fail(e2.message) }
  await audit(c, 'BUAT_AKUN', 'profiles', uid, { role, cabang_id, atasan_id: role === 'frontliner' ? atasan_id : null })
  return NextResponse.json({ ok: true })
})

// Edit: nama, atasan (frontliner), reset password, GPS. User ID tidak bisa diubah.
export const PATCH = handler(async req => {
  const c = await who(req); if (!c) return fail('Tidak diizinkan', 403)
  const { id, nama, password, atasan_id, gps_required, min_checkout_menit } = await req.json()
  const { data: t } = await c.db.from('profiles').select('role,cabang_id,user_id').eq('id', id).single()
  if (!t || !ROLES.includes(t.role)) return fail('Akun tidak ditemukan')
  if (!(await bolehCabang(c, t.cabang_id))) return fail('Cabang ini bukan wewenang Anda', 403)
  const upd: any = {}
  if (nama) upd.nama = nama
  if (typeof gps_required === 'boolean') {
    if (c.role !== 'mdm') return fail('Hanya MDM yang boleh mengatur GPS', 403)
    if (t.role !== 'frontliner') return fail('Pengaturan GPS hanya untuk frontliner')
    upd.gps_required = gps_required
  }
  if (min_checkout_menit !== undefined) {   // jarak minimal check-in ke check-out; 0 = tanpa batas
    const n = Number(min_checkout_menit)
    if (!Number.isInteger(n) || n < 0 || n > 120) return fail('Batas check-out harus bilangan bulat 0 sampai 120 menit')
    if (t.role !== 'frontliner') return fail('Batas check-out hanya untuk frontliner')
    upd.min_checkout_menit = n
  }
  if (t.role === 'frontliner' && atasan_id) {
    if (!(await atasanOk(c, atasan_id, t.cabang_id))) return fail('Atasan harus TL/Kormot di cabang yang sama')
    upd.atasan_id = atasan_id
  }
  if (Object.keys(upd).length) { const { error } = await c.db.from('profiles').update(upd).eq('id', id); if (error) return fail(error.message) }
  if (password) {
    if (String(password).length < 6) return fail('Password minimal 6 karakter')
    const { error } = await c.db.auth.admin.updateUserById(id, { password }); if (error) return fail(error.message)
  }
  await audit(c, typeof gps_required === 'boolean' ? 'UBAH_GPS' : min_checkout_menit !== undefined ? 'UBAH_BATAS_CHECKOUT' : password ? 'RESET_PASSWORD' : 'UBAH_AKUN', 'profiles', t.user_id, { ...upd, reset_password: !!password })
  return NextResponse.json({ ok: true })
})

export const DELETE = handler(async req => {
  const c = await who(req); if (!c) return fail('Tidak diizinkan', 403)
  const { id } = await req.json()
  const { data: t } = await c.db.from('profiles').select('role,cabang_id,user_id').eq('id', id).single()
  if (!t || !ROLES.includes(t.role)) return fail('Akun tidak ditemukan')
  if (!(await bolehCabang(c, t.cabang_id))) return fail('Cabang ini bukan wewenang Anda', 403)
  const { count } = await c.db.from('profiles').select('id', { count: 'exact', head: true }).eq('atasan_id', id)
  if (count) return fail(`Masih punya ${count} frontliner. Pindahkan atau hapus mereka dulu.`)
  if (t.role === 'frontliner') {   // outlet tidak boleh menjadi yatim: Kode MD di outlet bukan relasi ke akun
    const { count: no } = await c.db.from('outlets').select('id', { count: 'exact', head: true }).eq('kode_md', t.user_id)
    if (no) return fail(`Masih punya ${no} outlet (Kode MD ${t.user_id}). Pindahkan dulu lewat halaman Outlet > Pindahkan outlet.`)
  }
  const { error } = await c.db.auth.admin.deleteUser(id)
  if (error) return fail(error.message)
  await audit(c, 'HAPUS_AKUN', 'profiles', t.user_id, { role: t.role, cabang_id: t.cabang_id })
  return NextResponse.json({ ok: true })
})
