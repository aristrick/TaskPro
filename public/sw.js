// Service worker TaskPro (v16): menyimpan "kerangka" aplikasi supaya halaman frontliner tetap bisa dibuka saat sinyal hilang.
// Yang disimpan hanya berkas milik aplikasi ini (kode, ikon, halaman /m dan /login). Data Supabase, API, dan situs lain TIDAK pernah disimpan.
// Ganti nilai VERSI setiap kali aturan cache di bawah diubah, supaya cache lama dibersihkan.
const VERSI = 'taskpro-v16'
const SIAP = ['/offline.html', '/icon-192.png']
const HALAMAN = ['/m', '/login']          // halaman yang boleh disimpan salinannya untuk dibuka offline
const MAKS_BERKAS = 150                   // kode hasil build berganti nama tiap rilis; yang lama dibuang agar cache tidak membengkak

self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(VERSI).then(c => c.addAll(SIAP).catch(() => {}))) })
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== VERSI) await caches.delete(k)
  await self.clients.claim()
})()))

async function simpan(req, res) {
  const c = await caches.open(VERSI); await c.put(req, res)
  const k = await c.keys(); if (k.length > MAKS_BERKAS) await Promise.all(k.slice(0, k.length - MAKS_BERKAS).map(x => c.delete(x)))
}

self.addEventListener('fetch', e => {
  const r = e.request
  if (r.method !== 'GET') return
  const u = new URL(r.url)
  if (u.origin !== self.location.origin || u.pathname.startsWith('/api/')) return   // biarkan lewat jaringan biasa
  if (u.pathname.startsWith('/_next/static/') || /\.(png|svg|ico)$/.test(u.pathname) || u.pathname === '/manifest.webmanifest') {
    // Berkas bernama hash tidak pernah berubah isinya: cache dulu, jaringan jika belum ada
    e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => { if (res.ok) simpan(r, res.clone()); return res })))
  } else if (r.mode === 'navigate') {
    // Halaman: jaringan dulu (selalu versi terbaru bila online), salinan terakhir bila offline
    e.respondWith(fetch(r).then(res => { if (res.ok && HALAMAN.includes(u.pathname)) simpan(r, res.clone()); return res })
      .catch(async () => (await caches.match(r)) || (HALAMAN.includes(u.pathname) && (await caches.match('/m'))) || (await caches.match('/offline.html')) || Response.error()))
  }
})
