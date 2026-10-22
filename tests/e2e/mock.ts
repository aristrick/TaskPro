// Tiruan Supabase untuk tes E2E: auth + PostgREST secukupnya, dengan keadaan (data) yang bisa diubah per tes.
import type { Page, Route } from '@playwright/test'

export const SB = 'http://127.0.0.1:54321'
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' }
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
const uuid = () => crypto.randomUUID()

export type Produk = { id: string; product: string; brand: string; price: number; active: boolean }
export type Kunjungan = { id: string; outlet_id: number; checkin_at: string; checkout_at: string | null; project_id: string; items: { product_id: string; qty: number }[]; at_klien?: string }
export type Mock = ReturnType<typeof buatMock>

export function buatMock(opsi: { role?: string } = {}) {
  const me = { id: 'u-fl-1', user_id: '0300-TMTB01', nama: 'Adin Shandi', role: opsi.role || 'frontliner', cabang_id: 'cab-1', project_id: 'proj-1', gps_required: true, min_checkout_menit: 0 }
  const outlets = [
    { id: 1, name: 'Warung Sumber Rejeki', address: 'Jl. Rawa Kepiting 1', lat: -6.2, long: 106.8, kode_md: me.user_id, rayon: 1, status: 'AKTIF' },
    { id: 2, name: 'Toko Berkah Jaya', address: 'Jl. Cakung 22', lat: -6.21, long: 106.81, kode_md: me.user_id, rayon: 1, status: 'AKTIF' }]
  const produk: Produk[] = [
    { id: 'pr-1', product: 'BONTEH MATCHA', brand: 'Bonteh', price: 19500, active: true },
    { id: 'pr-2', product: 'BONTEH TEH TARIK', brand: 'Bonteh', price: 20000, active: true },
    { id: 'pr-3', product: 'SAYANG LIQUID 20ML', brand: 'Sayang', price: 2500, active: true }]
  const frontliners = [
    { id: 'u-fl-1', user_id: '0300-TMTB01', nama: 'Adin Shandi', cabang_id: 'cab-1', project_id: 'proj-1' },
    { id: 'u-fl-2', user_id: '0300-TMTB02', nama: 'Budi Santoso', cabang_id: 'cab-1', project_id: null as string | null },
    { id: 'u-fl-3', user_id: '0300-TMTB03', nama: 'Sari Wulandari', cabang_id: 'cab-1', project_id: null as string | null }]
  const projects = [{ id: 'proj-1', name: 'TASKFORCE BONTEH SUNTER', cabang_id: 'cab-1' }]
  const s = {
    me, outlets, produk, frontliners, projects, fokus: ['pr-1'], kunjungan: [] as Kunjungan[], online: true, passwordBenar: 'rahasia',
    rpc: [] as { fn: string; args: any }[], stokDibawa: 50, tolakSaveSales: '' as string, tanpaFungsiTertunda: false,
    aktif: () => s.kunjungan.find(v => !v.checkout_at) || null,
    panggilan: (fn: string) => s.rpc.filter(x => x.fn === fn),
  }
  return s
}

const sesi = (m: Mock) => ({ access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: m.me.id, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 86400 * 30 })}.sig`,
  token_type: 'bearer', expires_in: 86400, expires_at: Math.floor(Date.now() / 1000) + 86400, refresh_token: 'refresh-e2e',
  user: { id: m.me.id, aud: 'authenticated', role: 'authenticated', email: `${m.me.user_id.toLowerCase()}@taskpro.app`, app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } })

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) })
const galat = (route: Route, message: string, code = 'P0001') => json(route, { code, message, details: null, hint: null }, 400)

function rpc(m: Mock, fn: string, a: any, route: Route) {
  m.rpc.push({ fn, args: a })
  const v = a?.p_visit ? m.kunjungan.find(x => x.id === a.p_visit) : null
  switch (fn) {
    case 'sesi_klaim': return json(route, null)
    case 'sesi_detak': return json(route, true)
    case 'stok_hari_ini': return json(route, m.produk.map(p => ({ product_id: p.id, dibawa: m.stokDibawa, terjual: 0 })))
    case 'rekap_saya': return json(route, {})
    case 'project_set_member': { const f = m.frontliners.find(x => x.id === a.p_frontliner); if (f) f.project_id = a.p_project; return json(route, null) }
    case 'checkin': {
      if (m.aktif()) return galat(route, 'Masih ada kunjungan yang belum check-out.')
      const baru: Kunjungan = { id: uuid(), outlet_id: a.p_outlet, checkin_at: new Date().toISOString(), checkout_at: null, project_id: m.me.project_id, items: [] }
      m.kunjungan.push(baru); return json(route, baru.id)
    }
    case 'save_sales': {
      if (m.tolakSaveSales) return galat(route, m.tolakSaveSales)
      if (!v || v.checkout_at) return galat(route, 'Kunjungan tidak aktif.')
      v.items = a.p_items; return json(route, null)
    }
    case 'checkout': { if (!v || v.checkout_at) return galat(route, 'Kunjungan tidak aktif.'); v.checkout_at = new Date().toISOString(); return json(route, null) }
    case 'checkout_tertunda': {
      if (m.tanpaFungsiTertunda) return json(route, { code: 'PGRST202', message: 'Could not find the function public.checkout_tertunda(p_at, p_visit) in the schema cache', details: null, hint: null }, 404)
      if (!v || v.checkout_at) return galat(route, 'Kunjungan tidak aktif.')
      v.checkout_at = a.p_at; v.at_klien = a.p_at; return json(route, null)
    }
    default: return galat(route, `RPC ${fn} belum ditiru`, 'E2E00')
  }
}

function tabel(m: Mock, nama: string, u: URL) {
  const q = u.search
  switch (nama) {
    case 'profiles': return u.searchParams.get('role') === 'eq.frontliner' ? m.frontliners : [m.me]
    case 'projects': return m.projects
    case 'outlets': { const r = u.searchParams.get('rayon'); return m.outlets.filter(o => !r || r === `eq.${o.rayon}`) }
    case 'products': return m.produk
    case 'project_focus': return m.fokus.map(product_id => ({ project_id: 'proj-1', product_id }))
    case 'cabang': return [{ id: 'cab-1', kode: '0300', nama: 'Pulogadung', tz: 'Asia/Jakarta' }]
    case 'settings': return u.searchParams.get('key') === 'eq.stok_enforced' ? [{ value: true }] : []
    case 'visits': {
      if (q.includes('checkout_at=is.null')) { const v = m.aktif(); const o = v && m.outlets.find(x => x.id === v.outlet_id); return v && o ? [{ id: v.id, outlet_id: v.outlet_id, checkin_at: v.checkin_at, project_id: v.project_id, outlets: { name: o.name, address: o.address, lat: o.lat, long: o.long } }] : [] }
      if (q.includes('checkout_at=not.is.null')) { const sel = m.kunjungan.filter(x => x.checkout_at && String(x.outlet_id) === (u.searchParams.get('outlet_id') || '').replace('eq.', '')).slice(-1); return sel.map(x => ({ sales: x.items })) }
      return m.kunjungan.map(x => ({ outlet_id: x.outlet_id }))
    }
    default: return []
  }
}

// Pasang tiruan ke halaman. `masuk: true` menanam sesi login supaya tes tidak perlu mengetik User ID dan password.
export async function pasang(page: Page, m: Mock, opsi: { masuk?: boolean } = { masuk: true }) {
  if (opsi.masuk !== false) await page.addInitScript(([s]) => { localStorage.setItem('taskpro-auth', JSON.stringify(s)); localStorage.setItem('taskpro-claimed', '1') }, [sesi(m)] as const)
  await page.route(`${SB}/**`, async route => {
    const req = route.request(), u = new URL(req.url()), p = u.pathname
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    if (!m.online) return route.abort('internetdisconnected')
    if (p === '/auth/v1/token') {
      const b = JSON.parse(req.postData() || '{}')
      if (u.searchParams.get('grant_type') === 'password' && b.password !== m.passwordBenar) return json(route, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400)
      return json(route, sesi(m))
    }
    if (p === '/auth/v1/user') return json(route, sesi(m).user)
    if (p === '/auth/v1/logout') return route.fulfill({ status: 204, headers: CORS })
    if (p.startsWith('/rest/v1/rpc/')) return rpc(m, p.split('/').pop()!, JSON.parse(req.postData() || '{}'), route)
    if (p.startsWith('/rest/v1/') && req.method() !== 'GET') {   // tulis ke tabel: hanya project_focus yang punya keadaan
      const t = p.split('/').pop()!
      if (t === 'project_focus' && req.method() === 'POST') m.fokus.push(JSON.parse(req.postData() || '{}').product_id)
      if (t === 'project_focus' && req.method() === 'DELETE') { const id = (u.searchParams.get('product_id') || '').replace('eq.', ''); m.fokus = m.fokus.filter(x => x !== id) }
      return route.fulfill({ status: req.method() === 'POST' ? 201 : 204, headers: CORS })
    }
    if (p.startsWith('/rest/v1/')) return json(route, tabel(m, p.split('/').pop()!, u))
    return route.fulfill({ status: 404, headers: CORS, body: 'e2e: tidak ditiru' })
  })
}
