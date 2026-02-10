import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { TicketProvider } from './context/TicketContext'
import ThemeWrapper from './components/ThemeWrapper'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'GSS Management Hub',
  description: 'Central Administrative Portal for GSS Facility Services',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={inter.variable}>
        <TicketProvider>
          <ThemeWrapper>
            {children}
          </ThemeWrapper>
        </TicketProvider>
      </body>
    </html>
  )
}
