'use client'

import { useEffect, useState } from 'react'
import { PERIOD_GRADIENTS, periodForHour, type Period } from '@/lib/timeOfDay'

const PERIODS = Object.keys(PERIOD_GRADIENTS) as Period[]

/**
 * Full-viewport background tint for the home page, keyed to the local time.
 *
 * Every period renders as its own layer and crossfades on opacity rather than
 * swapping one element's `background-image` -- gradients aren't an animatable
 * property, so a transition on the image itself would just pop.
 *
 * Fixed rather than confined to the page container so the tint runs behind the
 * floating BottomNav too; anchoring it to the scroll area would leave a visible
 * seam where the nav starts.
 */
export default function TimeOfDayBackdrop() {
  // Null until mounted: the period depends on the viewer's timezone, so
  // resolving it during SSR would bake in the server's clock and mismatch on
  // hydration. Every layer starts hidden and the right one fades up, which
  // reads as an intentional wash rather than a flash.
  const [period, setPeriod] = useState<Period | null>(null)

  useEffect(() => {
    const sync = () => setPeriod(periodForHour(new Date().getHours()))
    sync()
    // Cheap enough to poll, and it means leaving the app open across a boundary
    // (say 17:00) drifts the background into evening on its own.
    const id = setInterval(sync, 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div aria-hidden className="fixed inset-0 pointer-events-none" style={{ zIndex: -1 }}>
      {PERIODS.map(key => (
        <div
          key={key}
          className="absolute inset-0 motion-safe:transition-opacity motion-safe:duration-[1800ms]"
          style={{
            backgroundImage: PERIOD_GRADIENTS[key],
            opacity: period === key ? 1 : 0,
          }}
        />
      ))}
    </div>
  )
}
