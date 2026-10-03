import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const fail = (error: string, status = 400) => NextResponse.json({ error }, { status })

// Klien service role. Jika environment belum diisi, pesan errornya jelas (bukan gagal diam-diam).
export function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Server belum dikonfigurasi: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi di Environment Variables.')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// Siapa yang memanggil API (dari token Bearer) dan apa rolenya.
export async function caller(req: NextRequest) {
  const db = admin()
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: u } = await db.auth.getUser(token)
  if (!u.user) return null
  const { data: p } = await db.from('profiles').select('role').eq('id', u.user.id).single()
  return p ? { db, uid: u.user.id, role: p.role as string } : null
}
export type Ctx = NonNullable<Awaited<ReturnType<typeof caller>>>

// Semua error tak terduga dikembalikan sebagai JSON agar tampil di layar, bukan halaman error kosong.
export const handler = (fn: (req: NextRequest) => Promise<NextResponse>) => async (req: NextRequest) => {
  try { return await fn(req) } catch (e: any) { return fail(e?.message || 'Kesalahan server', 500) }
}

// Catat tindakan admin yang dikerjakan lewat server (service role tidak membawa identitas pengguna, jadi pelaku dicatat eksplisit).
// Kegagalan mencatat tidak boleh menggagalkan tindakan utamanya. Jangan pernah memasukkan password ke detail.
export async function audit(c: Ctx, action: string, tabel: string, rowId: string, detail: Record<string, unknown> = {}) {
  try {
    const { data: me } = await c.db.from('profiles').select('user_id').eq('id', c.uid).maybeSingle()
    await c.db.from('audit_log').insert({ actor: c.uid, actor_user_id: me?.user_id ?? null, action, tabel, row_id: rowId, detail })
  } catch { /* abaikan */ }
}
