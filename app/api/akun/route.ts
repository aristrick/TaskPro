import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const ROLES = ['tl', 'kormot', 'frontliner']
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status })
type Ctx = NonNullable<Awaited<ReturnType<typeof who>>>

async function who(req: NextRequest) {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: u } = await db.auth.getUser(req.headers.get('authorization')?.replace('Bearer ', ''))
  if (!u.user) return null
  const { data: p } = await db.from('profiles').select('role').eq('id', u.user.id).single()
  return p ? { db, uid: u.user.id, role: p.role as string } : null
}
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

export async function POST(req: NextRequest) {
  const c = await who(req); if (!c) return fail('Tidak diizinkan', 403)
  const { user_id, nama, password, role, cabang_id, atasan_id } = await req.json()
  if (!user_id || !nama || !password || !cabang_id || !ROLES.includes(role)) return fail('Semua kolom wajib diisi')
  if (!(await bolehCabang(c, cabang_id))) return fail('Cabang ini bukan wewenang Anda', 403)
  const { data: cb } = await c.db.from('cabang').select('kode').eq('id', cabang_id).single()
  const uid = String(user_id).trim().toUpperCase()
  if (!cb || !uid.startsWith(cb.kode + '-')) return fail(`User ID harus diawali ${cb?.kode}- (kode cabang)`)
  if (role === 'frontliner' && !(await atasanOk(c, atasan_id, cabang_id))) return fail('Atasan harus TL/Kormot di cabang yang sama')
  const { data, error } = await c.db.auth.admin.createUser({ email: uid.toLowerCase() + '@taskpro.app', password, email_confirm: true })
  if (error) return fail(error.message.includes('already') ? 'User ID sudah dipakai' : error.message)
  const { error: e2 } = await c.db.from('profiles').insert({
    id: data.user.id, user_id: uid, nama, role, cabang_id, atasan_id: role === 'frontliner' ? atasan_id : null })
  if (e2) { await c.db.auth.admin.deleteUser(data.user.id); return fail(e2.message) }
  return NextResponse.json({ ok: true })
}

// Edit: nama, atasan (frontliner), reset password. User ID tidak bisa diubah.
export async function PATCH(req: NextRequest) {
  const c = await who(req); if (!c) return fail('Tidak diizinkan', 403)
  const { id, nama, password, atasan_id, gps_required } = await req.json()
  const { data: t } = await c.db.from('profiles').select('role,cabang_id').eq('id', id).single()
  if (!t || !ROLES.includes(t.role)) return fail('Akun tidak ditemukan')
  if (!(await bolehCabang(c, t.cabang_id))) return fail('Cabang ini bukan wewenang Anda', 403)
  const upd: any = {}
  if (nama) upd.nama = nama
  if (typeof gps_required === 'boolean') {
    if (c.role !== 'mdm') return fail('Hanya MDM yang boleh mengatur GPS', 403)
    if (t.role !== 'frontliner') return fail('Pengaturan GPS hanya untuk frontliner')
    upd.gps_required = gps_required
  }
  if (t.role === 'frontliner' && atasan_id) {
    if (!(await atasanOk(c, atasan_id, t.cabang_id))) return fail('Atasan harus TL/Kormot di cabang yang sama')
    upd.atasan_id = atasan_id
  }
  if (Object.keys(upd).length) { const { error } = await c.db.from('profiles').update(upd).eq('id', id); if (error) return fail(error.message) }
  if (password) { const { error } = await c.db.auth.admin.updateUserById(id, { password }); if (error) return fail(error.message) }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const c = await who(req); if (!c) return fail('Tidak diizinkan', 403)
  const { id } = await req.json()
  const { data: t } = await c.db.from('profiles').select('role,cabang_id').eq('id', id).single()
  if (!t || !ROLES.includes(t.role)) return fail('Akun tidak ditemukan')
  if (!(await bolehCabang(c, t.cabang_id))) return fail('Cabang ini bukan wewenang Anda', 403)
  const { count } = await c.db.from('profiles').select('id', { count: 'exact', head: true }).eq('atasan_id', id)
  if (count) return fail(`Masih punya ${count} frontliner. Pindahkan atau hapus mereka dulu.`)
  const { error } = await c.db.auth.admin.deleteUser(id)
  return error ? fail(error.message) : NextResponse.json({ ok: true })
}
