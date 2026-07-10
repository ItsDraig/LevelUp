interface HeroProps {
  streak: number
  width?: number
  height?: number
  celebrating?: boolean
}

/**
 * The stick-figure hero sitting at a campfire.
 * Fire scales from dead (streak=0) to roaring (streak=30+).
 * Swap this component out for a sprite/animation later without touching anything else.
 */
export default function Hero({ streak, width = 176, height = 145, celebrating = false }: HeroProps) {
  const dead = streak === 0
  const size = dead ? 0 : Math.min(streak / 30, 1)

  const cx = width * 0.5
  const logY = height * 0.77

  // Hero geometry
  const headY = celebrating ? height * 0.36 : height * 0.4
  const bodyY1 = headY + 9
  const bodyY2 = bodyY1 + (celebrating ? 22 : 24)
  const armY   = bodyY1 + (celebrating ? 8 : 6)
  const legY   = logY - 4

  const armLx = celebrating ? cx - 18 : cx - 15
  const armLy = celebrating ? armY - 16 : armY + 10
  const armRx = celebrating ? cx + 18 : cx + 15
  const armRy = celebrating ? armY - 16 : armY + 10

  // Fire geometry -- scales with streak
  const glowR = 18 + size * 24
  const f1h   = 10 + size * 20
  const fw1   = 8  + size * 9
  const f2h   = 7  + size * 13
  const fw2   = 5  + size * 7
  const f3h   = 6  + size * 11
  const logW  = 14 + size * 5
  const alpha = 0.7 + size * 0.25

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={`Hero at campfire, streak day ${streak}`}
    >
      {/* --- FIRE --- */}
      {dead ? (
        <>
          <ellipse cx={cx} cy={logY - 4} rx={12} ry={3} fill="#3A2A1A" opacity={0.6} />
          <line x1={cx - 14} y1={logY} x2={cx + 14} y2={logY} stroke="#3A2A1A" strokeWidth={3.5} strokeLinecap="round" />
          <line x1={cx - 8} y1={logY} x2={cx - 2} y2={logY - 10} stroke="#3A2A1A" strokeWidth={2.5} strokeLinecap="round" />
          <line x1={cx + 8} y1={logY} x2={cx + 2} y2={logY - 10} stroke="#3A2A1A" strokeWidth={2.5} strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx={cx} cy={logY + 2} rx={glowR} ry={6 + size * 4} fill="#E8A320" opacity={0.12} />
          <line x1={cx - logW} y1={logY} x2={cx + logW} y2={logY} stroke="#6B3A1F" strokeWidth={3.5} strokeLinecap="round" />
          <line x1={cx - 8} y1={logY} x2={cx - 2} y2={logY - 10} stroke="#6B3A1F" strokeWidth={2.5} strokeLinecap="round" />
          <line x1={cx + 8} y1={logY} x2={cx + 2} y2={logY - 10} stroke="#6B3A1F" strokeWidth={2.5} strokeLinecap="round" />
          <ellipse cx={cx}          cy={logY - f1h / 2}    rx={fw1}       ry={f1h / 2} fill="#D85A30" opacity={alpha} />
          <ellipse cx={cx - fw2 * 0.6} cy={logY - f2h * 0.55} rx={fw2}   ry={f2h / 2} fill="#E8A320" opacity={alpha} />
          <ellipse cx={cx + fw2 * 0.6} cy={logY - f2h * 0.55} rx={fw2}   ry={f2h / 2} fill="#E8A320" opacity={alpha} />
          <ellipse cx={cx}          cy={logY - f1h * 0.85} rx={fw1 * 0.55} ry={f3h / 2} fill="#FAC75A" opacity={0.9} />
          {size > 0.3 && (
            <ellipse cx={cx} cy={logY - f1h} rx={fw1 * 0.3} ry={f3h * 0.4} fill="#fff" opacity={0.18} />
          )}
        </>
      )}

      {/* --- HERO --- */}
      {/* Legs */}
      <line x1={cx - 5} y1={bodyY2} x2={cx - 9} y2={legY} stroke="#C8C4BC" strokeWidth={2.5} strokeLinecap="round" />
      <line x1={cx + 5} y1={bodyY2} x2={cx + 9} y2={legY} stroke="#C8C4BC" strokeWidth={2.5} strokeLinecap="round" />
      {/* Torso */}
      <line x1={cx} y1={bodyY1} x2={cx} y2={bodyY2} stroke="#C8C4BC" strokeWidth={2.5} strokeLinecap="round" />
      {/* Arms */}
      <line x1={cx} y1={armY} x2={armLx} y2={armLy} stroke="#C8C4BC" strokeWidth={2.5} strokeLinecap="round" />
      <line x1={cx} y1={armY} x2={armRx} y2={armRy} stroke="#C8C4BC" strokeWidth={2.5} strokeLinecap="round" />
      {/* Head */}
      <circle cx={cx} cy={headY} r={9} stroke="#C8C4BC" strokeWidth={2} fill="#0F0F0F" />
    </svg>
  )
}
