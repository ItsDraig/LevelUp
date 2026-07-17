'use client'

import { useEffect, useRef, useState } from 'react'
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

// Scroll events don't bubble, but they do fire on `window` during the
// capture phase for any scrollable descendant -- so one listener here
// covers every page's own scroll container without each page having to
// wire anything up.
export default function BottomNav() {
  const pathname = usePathname()
  const [shrunk, setShrunk] = useState(false)
  const lastTop = useRef(0)
  const lastTarget = useRef<EventTarget | null>(null)

  // This component lives in the root layout, so it stays mounted across
  // route changes -- expand back to full size whenever the tab changes,
  // rather than snapping instantly on a fresh mount. Adjusting state
  // during render (comparing against a previous-props snapshot in state)
  // is usually preferred here, but Next's router transition re-renders
  // this component multiple times per navigation and that pattern
  // produced visible state oscillation; an effect keyed on `pathname` is
  // the reliable option.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShrunk(false)
  }, [pathname])

  useEffect(() => {
    function handleScroll(e: Event) {
      // When the whole page overflows (rather than one of the app's own
      // `overflow-y-auto` containers), the scroll event's target is
      // `document` itself, which has no `.scrollTop` -- read it off
      // scrollingElement/documentElement instead.
      const target = e.target
      const source: EventTarget = target === document ? document : (target as EventTarget)
      const scrollTop = target === document
        ? (document.scrollingElement?.scrollTop ?? document.documentElement.scrollTop)
        : (target as HTMLElement)?.scrollTop

      if (typeof scrollTop !== 'number') return

      // New scroll container (e.g. navigated to a different page) --
      // establish a baseline instead of reacting to the jump.
      if (source !== lastTarget.current) {
        lastTarget.current = source
        lastTop.current = scrollTop
        return
      }

      const delta = scrollTop - lastTop.current
      lastTop.current = scrollTop

      if (scrollTop <= 4) {
        setShrunk(false)
      } else if (delta > 6) {
        setShrunk(true)
      } else if (delta < -6) {
        setShrunk(false)
      }
    }

    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [])

  const isAppRoute = NAV_ITEMS.some(item => item.href === pathname)
  if (!isAppRoute) return null

  return (
    <nav
      className="flex flex-shrink-0 justify-center px-4 pt-2"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}
    >
      <motion.div
        className="flex items-center rounded-full"
        initial={false}
        animate={{ scale: shrunk ? 0.78 : 1 }}
        transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
        style={{
          gap: 6,
          padding: 8,
          background: 'rgba(26,26,26,0.7)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid var(--border2)',
          boxShadow: '0 8px 28px rgba(0,0,0,0.4)',
          transformOrigin: 'bottom center',
        }}
      >
        {NAV_ITEMS.map(({ href, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className="relative flex items-center justify-center"
              style={{ width: 48, height: 48 }}
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
                size={21}
                strokeWidth={active ? 2.25 : 2}
                className="relative"
                style={{ color: active ? 'var(--gold)' : 'var(--text2)' }}
              />
            </Link>
          )
        })}
      </motion.div>
    </nav>
  )
}
