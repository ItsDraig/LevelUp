import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import BottomNav from '@/components/layout/BottomNav'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Level Up!',
  description: 'Gamified habit tracker',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-bg text-text antialiased">
        <main className="h-dvh flex items-start justify-center">
          <div className="w-full max-w-sm h-dvh flex flex-col">
            {children}
            <BottomNav />
          </div>
        </main>
      </body>
    </html>
  )
}
