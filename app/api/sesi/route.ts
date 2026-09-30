import { NextResponse } from 'next/server'
import { caller, fail, handler } from '../../../lib/server'

// Logout paksa: mengakhiri semua sesi perangkat sebuah akun. Perangkat yang bersangkutan keluar dalam <= 45 detik.
//  MDM: semua akun lain. RMDM: MDS + akun di cabang yang dicover. MDS: TL/Kormot/Frontliner di cabangnya.
export const POST = handler(async req => {
  const c = await caller(req); if (!c || !['mdm', 'rmdm', 'mds'].includes(c.role)) return fail('Tidak diizinkan', 403)
  const { id } = await req.json()
  if (!id || id === c.uid) return fail('Gunakan tombol Log out untuk keluar dari akun Anda sendiri')
  const { data: t } = await c.db.from('profiles').select('role,cabang_id').eq('id', id).maybeSingle()
  if (!t) return fail('Akun tidak ditemukan')
  let ok = c.role === 'mdm'
  if (!ok && ['tl', 'kormot', 'frontliner'].includes(t.role) && t.cabang_id) {
    const col = c.role === 'mds' ? 'mds_id' : 'rmdm_id'
    const { data } = await c.db.from('cabang').select('id').eq('id', t.cabang_id).eq(col, c.uid).maybeSingle(); ok = !!data
  }
  if (!ok && c.role === 'rmdm' && t.role === 'mds') ok = true
  if (!ok) return fail('Akun ini bukan wewenang Anda', 403)
  const { error } = await c.db.rpc('sesi_paksa', { p_user: id })
  if (error) return fail(/sesi_paksa/.test(error.message) ? 'Jalankan 08_migration.sql di Supabase terlebih dulu.' : error.message)
  return NextResponse.json({ ok: true })
})
