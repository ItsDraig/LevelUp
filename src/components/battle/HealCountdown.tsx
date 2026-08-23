'use client'

import { useEffect, useState } from 'react'
import { formatHealCountdown, minutesToFullHeal } from '@/lib/battle'

interface HealCountdownProps {
  currentHp: number
  maxHp: number
}

/**
 * "2h 24m till fully healed", shown only while HP is below full.
 *
 * Re-renders on a slow interval so the figure stays honest while the player
 * sits on the screen; it is derived from HP rather than counted down from a
 * fixed target, so it stays correct when HP changes underneath it mid-fight.
 */
export default function HealCountdown({ currentHp, maxHp }: HealCountdownProps) {
  // Only used to force a periodic recompute -- the value itself is unused.
  const [, setTick] = useState(0)

  const minutes = minutesToFullHeal(currentHp, maxHp)

  useEffect(() => {
    if (minutes <= 0) return
    const id = setInterval(() => setTick(t => t + 1), 20_000)
    return () => clearInterval(id)
  }, [minutes])

  if (minutes <= 0) return null

  return (
    <p className="text-[10px] mt-1" style={{ color: 'var(--text2)' }}>
      {formatHealCountdown(minutes)}
    </p>
  )
}
