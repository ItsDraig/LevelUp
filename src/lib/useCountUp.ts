import { useEffect, useRef, useState } from 'react'

/**
 * Animates a displayed number toward `target` whenever it changes, instead
 * of jumping instantly. Used for the gold counter so earning/spending gold
 * feels like something happened.
 */
export function useCountUp(target: number, duration = 500): number {
  const [display, setDisplay] = useState(target)
  const fromRef = useRef(target)

  useEffect(() => {
    const from = fromRef.current
    const to = target
    if (from === to) return

    const start = performance.now()
    let raf: number

    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(from + (to - from) * eased))
      if (t < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return display
}
