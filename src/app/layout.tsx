import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import BottomNav from '@/components/layout/BottomNav'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Level Up!',
  description: 'Gamified habit tracker',
  // Drops the Safari UI when launched from the iOS home screen. The manifest's
  // `display: standalone` covers Android; iOS still keys off this meta tag.
  appleWebApp: {
    capable: true,
    title: 'Level Up!',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Required for `env(safe-area-inset-*)` to report anything but 0 -- BottomNav
  // already pads against the home indicator, but only takes effect with this.
  viewportFit: 'cover',
  themeColor: '#0F0F0F',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-bg text-text antialiased">
        <main className="h-dvh flex items-start justify-center">
          {/* `black-translucent` lets content run under the status bar, so the
              notch/Dynamic Island needs clearing explicitly. Resolves to 0 in a
              browser tab and on devices without one. Tailwind's border-box means
              this eats into h-dvh rather than overflowing it. */}
          <div
            className="w-full max-w-sm h-dvh flex flex-col"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
          >
            {children}
            <BottomNav />
          </div>
        </main>
      </body>
    </html>
  )
}
