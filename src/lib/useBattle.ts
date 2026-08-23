'use client'

import { useCallback, useEffect, useReducer } from 'react'
import { battleReducer, initialBattleState, type BattleState } from './battleReducer'
import type { Enemy, PlayerAction, Profile, ShopItem } from '@/types'

/**
 * Largest slice of time a single tick may advance.
 *
 * requestAnimationFrame stops firing in a backgrounded tab, so returning to
 * one hands us a huge delta. Clamping means the fight *pauses* while you're
 * away rather than fast-forwarding you into a death you never saw.
 */
const MAX_STEP_MS = 250

export interface UseBattle {
  state: BattleState
  start: (enemy: Enemy, profile: Profile, weapon: ShopItem | null, startingHp: number) => void
  select: (action: PlayerAction) => void
  quit: () => void
}

export function useBattle(): UseBattle {
  const [state, dispatch] = useReducer(battleReducer, initialBattleState)

  useEffect(() => {
    if (state.phase !== 'fighting') return

    let frame = 0
    let previous = performance.now()

    const step = (now: number) => {
      const deltaMs = Math.min(now - previous, MAX_STEP_MS)
      previous = now
      dispatch({ type: 'tick', deltaMs })
      frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
    // Only the phase gates the loop; the reducer owns everything else, so this
    // never needs to re-subscribe on state changes.
  }, [state.phase])

  const start = useCallback(
    (enemy: Enemy, profile: Profile, weapon: ShopItem | null, startingHp: number) => {
      dispatch({ type: 'start', enemy, profile, weapon, startingHp })
    },
    [],
  )

  const select = useCallback((action: PlayerAction) => {
    dispatch({ type: 'select', action })
  }, [])

  const quit = useCallback(() => dispatch({ type: 'quit' }), [])

  return { state, start, select, quit }
}
