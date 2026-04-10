import type { Metadata } from 'next'
import './globals.css'
import { TicketProvider } from './context/TicketContext'
import ThemeWrapper from './components/ThemeWrapper'
import SWRegistration from './components/SWRegistration'
import InactivityGuard from './components/InactivityGuard'

// Iconos solo en <head> con rutas relativas: en Docker/Railway el build a veces no tiene URL pública,
// y metadataBase incorrecta rompe el favicon (apunta a localhost).
export const metadata: Metadata = {
  title: 'GSS Management Hub',
  description: 'Central Administrative Portal for GSS Facility Services',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
      </head>
      <body>
        <TicketProvider>
          <ThemeWrapper>
            <InactivityGuard />
            <SWRegistration />
            {children}
          </ThemeWrapper>
        </TicketProvider>
      </body>
    </html>
  )
}
