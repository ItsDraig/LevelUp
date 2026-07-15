'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'motion/react'
import { ShoppingBag, Swords, Home, ListChecks, User } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/shop',    icon: ShoppingBag },
  { href: '/battle',  icon: Swords },
  { href: '/home',    icon: Home },
  { href: '/tasks',   icon: ListChecks },
  { href: '/profile', icon: User },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="flex flex-shrink-0 justify-center px-4 pt-2"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}
    >
      <div
        className="flex items-center gap-1 rounded-full p-1.5"
        style={{
          background: 'rgba(26,26,26,0.7)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid var(--border2)',
          boxShadow: '0 8px 28px rgba(0,0,0,0.4)',
        }}
      >
        {NAV_ITEMS.map(({ href, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className="relative flex items-center justify-center"
              style={{ width: 44, height: 44 }}
            >
              {active && (
                <motion.div
                  layoutId="bottomNavActivePill"
                  className="absolute inset-0 rounded-full"
                  style={{ background: 'var(--surface3)' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                />
              )}
              <Icon
                size={20}
                strokeWidth={active ? 2.25 : 2}
                className="relative"
                style={{ color: active ? 'var(--gold)' : 'var(--text2)' }}
              />
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
