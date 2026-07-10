'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShoppingBag, Swords, Home, ListChecks, User } from 'lucide-react'

const NAV_ITEMS = [
  { label: 'Shop',    href: '/shop',    icon: ShoppingBag },
  { label: 'Battle',  href: '/battle',  icon: Swords },
  { label: 'Home',    href: '/home',    icon: Home },
  { label: 'Tasks',   href: '/tasks',   icon: ListChecks },
  { label: 'Profile', href: '/profile', icon: User },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="flex flex-shrink-0"
      style={{ borderTop: '0.5px solid var(--border)', background: 'var(--bg)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium tracking-wide transition-colors"
            style={{ color: active ? 'var(--gold)' : 'var(--text2)' }}
          >
            <Icon size={20} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
