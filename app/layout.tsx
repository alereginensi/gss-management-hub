import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { TicketProvider } from './context/TicketContext'
import ThemeWrapper from './components/ThemeWrapper'
import SWRegistration from './components/SWRegistration'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'GSS Management Hub',
  description: 'Central Administrative Portal for GSS Facility Services',
  icons: {
    icon: '/logo.png',
  },
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
      <body className={inter.variable}>
        <TicketProvider>
          <ThemeWrapper>
            <SWRegistration />
            {children}
          </ThemeWrapper>
        </TicketProvider>
      </body>
    </html>
  )
}
