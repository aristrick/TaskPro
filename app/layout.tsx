import './globals.css'
export const metadata = { title: 'TaskPro' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="id"><head><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" /><meta name="theme-color" content="#0B1F4B" /></head><body>{children}</body></html>
}
