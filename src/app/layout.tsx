import type { Metadata } from 'next'
import './globals.css'
import QueryProvider from '@/components/QueryProvider'

export const metadata: Metadata = {
  title: 'ProCovar Delivery',
  description: 'Delivery Route Optimization & Pricing Platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
