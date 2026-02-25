import type { Metadata, Viewport } from 'next'
import './globals.css'
import { SWRegister } from './sw-register'

export const metadata: Metadata = {
  title: 'Max Dashboard',
  description: 'AI Assistant Command Center',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1a1f24',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        {children}
        <SWRegister />
      </body>
    </html>
  )
}
