import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status })
// MDM/RMDM boleh membuat/menghapus MDS. Hanya MDM yang boleh membuat/menghapus RMDM.
async function guard(req: NextRequest) {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: u } = await db.auth.getUser(req.headers.get('authorization')?.replace('Bearer ', ''))
  if (!u.user) return null
  const { data: p } = await db.from('profiles').select('role').eq('id', u.user.id).single()
  return p && ['mdm', 'rmdm'].includes(p.role) ? { db, role: p.role as string } : null
}

export async function POST(req: NextRequest) {
  const g = await guard(req); if (!g) return fail('Tidak diizinkan', 403)
  const { user_id, nama, password, role = 'mds' } = await req.json()
  if (!user_id || !nama || !password) return fail('Semua kolom wajib diisi')
  if (!['mds', 'rmdm'].includes(role)) return fail('Role tidak valid')
  if (role === 'rmdm' && g.role !== 'mdm') return fail('Hanya MDM yang boleh membuat RMDM', 403)
  const uid = String(user_id).trim().toUpperCase()
  const { data, error } = await g.db.auth.admin.createUser({ email: uid.toLowerCase() + '@taskpro.app', password, email_confirm: true })
  if (error) return fail(error.message.includes('already') ? 'User ID sudah dipakai' : error.message)
  const { error: e2 } = await g.db.from('profiles').insert({ id: data.user.id, user_id: uid, nama, role })
  if (e2) { await g.db.auth.admin.deleteUser(data.user.id); return fail(e2.message) }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const g = await guard(req); if (!g) return fail('Tidak diizinkan', 403)
  const { id } = await req.json()
  const { data: t } = await g.db.from('profiles').select('role').eq('id', id).single()
  if (!t || !['mds', 'rmdm'].includes(t.role)) return fail('Bukan akun MDS/RMDM')
  if (t.role === 'rmdm' && g.role !== 'mdm') return fail('Hanya MDM yang boleh menghapus RMDM', 403)
  const { error } = await g.db.auth.admin.deleteUser(id) // cabang.mds_id / rmdm_id otomatis kosong
  return error ? fail(error.message) : NextResponse.json({ ok: true })
}
