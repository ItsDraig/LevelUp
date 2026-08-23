interface HealthBarProps {
  value: number
  max: number
  color: string
  /** Fills left-to-right as the next tick charges. */
  charge?: number
  height?: number
}

export default function HealthBar({ value, max, color, charge, height = 8 }: HealthBarProps) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0

  return (
    <div className="w-full">
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height, background: 'var(--surface3)' }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: color,
            // Snappy enough to read as a hit, slow enough to see it move.
            transition: 'width 220ms cubic-bezier(0.4,0,0.2,1)',
          }}
        />
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
