import type { MetadataRoute } from 'next'
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TaskPro', short_name: 'TaskPro', description: 'Kunjungan dan penjualan Taskforce', start_url: '/', display: 'standalone', orientation: 'portrait',
    background_color: '#0B1F4B', theme_color: '#0B1F4B',
    icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }],
  }
}
