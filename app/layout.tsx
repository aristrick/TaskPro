import './globals.css'
import Providers from '../components/Providers'
export const metadata = { title: 'TaskPro', applicationName: 'TaskPro', icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' }, appleWebApp: { capable: true, title: 'TaskPro', statusBarStyle: 'default' as const } }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="id"><head><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" /><meta name="theme-color" content="#0B1F4B" /></head><body><Providers>{children}</Providers></body></html>
}
