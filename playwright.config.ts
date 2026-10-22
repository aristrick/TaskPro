import { defineConfig } from '@playwright/test'

// Tes uji-ujung: aplikasi asli (hasil build) dijalankan di browser sungguhan, sedangkan Supabase ditiru oleh tests/e2e/mock.ts.
// Tidak menyentuh database Anda. Jalankan:  npx playwright install chromium   lalu   npm run test:e2e
const PORT = 3100
export default defineConfig({
  testDir: 'tests/e2e', timeout: 60_000, workers: 1, retries: 0, reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, viewport: { width: 390, height: 800 }, permissions: ['geolocation'], geolocation: { latitude: -6.2, longitude: 106.8 }, locale: 'id-ID', timezoneId: 'Asia/Jakarta' },
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`, port: PORT, timeout: 300_000, reuseExistingServer: true,
    env: { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'e2e-anon-key' },
  },
})
