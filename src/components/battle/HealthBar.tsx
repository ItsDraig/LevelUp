interface HealthBarProps {
  value: number
  max: number
  color: string
  /**
   * Colour for the portion of `value` above `max` -- the temporary overheal
   * granted by clearing a day's tasks. Omit on bars that cannot overheal
   * (XP, mana, enemy HP) and the segment never renders.
   */
  overhealColor?: string
  /** Fills left-to-right as the next tick charges. */
  charge?: number
  height?: number
}

export default function HealthBar({
  value,
  max,
  color,
  overhealColor,
  charge,
  height = 8,
}: HealthBarProps) {
  // Bars that cannot overheal keep the original clamp at `max`, so a stray
  // out-of-range value still reads as a full bar rather than silently
  // under-filling once the track starts representing the total instead.
  const clamped = Math.max(0, value)
  const safeValue = overhealColor ? clamped : Math.min(clamped, max)
  const overheal = Math.max(0, safeValue - max)

  // While overhealed the track represents the *total*, not the max, so the
  // bonus has somewhere to be drawn -- a bar already at 100% width has no room
  // to show anything beyond it. The consequence is that the bar reads as full
  // for as long as any bonus remains and it is the coloured segment that
  // visibly shrinks, which is the right signal: the buffer is being spent, not
  // your health. Once the bonus is gone the denominator is `max` again and the
  // bar drains normally.
  const total = Math.max(max, safeValue)
  const basePct = total > 0 ? (Math.min(safeValue, max) / total) * 100 : 0
  const overhealPct = total > 0 ? (overheal / total) * 100 : 0

  return (
    <div className="w-full">
      <div
        className="w-full rounded-full overflow-hidden flex"
        style={{ height, background: 'var(--surface3)' }}
      >
        <div
          className="h-full"
          style={{
            width: `${basePct}%`,
            background: color,
            // Snappy enough to read as a hit, slow enough to see it move.
            transition: 'width 220ms cubic-bezier(0.4,0,0.2,1)',
          }}
        />
        {overheal > 0 && (
          <div
            className="h-full"
            style={{
              width: `${overhealPct}%`,
              background: overhealColor,
              // A hairline against the base segment, so the two are separable
              // even where the colours sit close together.
              boxShadow: 'inset 1px 0 0 var(--surface3)',
              transition: 'width 220ms cubic-bezier(0.4,0,0.2,1)',
            }}
          />
        )}
      </div>

      {charge !== undefined && (
        <div
          className="w-full rounded-full overflow-hidden mt-1"
          style={{ height: 3, background: 'var(--surface2)' }}
        >
          <div
            className="h-full"
            style={{
              width: `${Math.max(0, Math.min(1, charge)) * 100}%`,
              background: 'var(--border2)',
            }}
          />
        </div>
      )}
    </div>
  )
}
