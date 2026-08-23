interface HeroProps {
  streak: number
  width?: number
  height?: number
  celebrating?: boolean
}

// Same register as the battle enemies in EnemySprite.tsx: flat filled shapes,
// a small fixed palette, no strokes doing the structural work.
const SKIN   = '#E8B98A'
const SKIN_2 = '#C99468'
const HAIR   = '#3B2C21'
const TUNIC  = '#4A6FA5'
const TUNIC_2 = '#33507B'
const LEATHER = '#6E4A2E'
const BOOT   = '#4A3324'
const GOLD   = '#E8A320'

/**
 * The hero at their campfire. Fire scales from dead (streak=0) to roaring
 * (streak=30+); `celebrating` throws the arms up.
 *
 * Drawn in a fixed 64-wide local space and then transformed into place, so the
 * proportions hold at every size it is rendered at (44px in a list, 180px on
 * the home screen) instead of being re-derived from width/height per element.
 */
export default function Hero({ streak, width = 176, height = 145, celebrating = false }: HeroProps) {
  const dead = streak === 0
  const size = dead ? 0 : Math.min(streak / 30, 1)

  const cx = width * 0.5
  const logY = height * 0.77

  // Fire geometry -- scales with streak
  const glowR = 18 + size * 24
  const f1h   = 10 + size * 20
  const fw1   = 8  + size * 9
  const f2h   = 7  + size * 13
  const fw2   = 5  + size * 7
  const f3h   = 6  + size * 11
  const logW  = 14 + size * 5
  const alpha = 0.7 + size * 0.25

  // The figure is authored 40 wide x 46 tall, then scaled so it stands on the
  // log line at a consistent fraction of the overall height.
  const figureH = height * 0.52
  const scale = figureH / 46
  const figureX = cx - (40 * scale) / 2
  const figureY = logY - figureH - 3 * scale

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={`Hero at campfire, streak day ${streak}`}
    >
      {/* --- FIRE (behind the figure) --- */}
      {dead ? (
        <>
          <ellipse cx={cx} cy={logY - 4} rx={12} ry={3} fill="#3A2A1A" opacity={0.6} />
          <rect x={cx - 14} y={logY - 2} width={28} height={4} rx={2} fill="#3A2A1A" />
          <rect x={cx - 9} y={logY - 9} width={4} height={9} rx={2} fill="#332417" transform={`rotate(-22 ${cx - 7} ${logY - 5})`} />
          <rect x={cx + 5} y={logY - 9} width={4} height={9} rx={2} fill="#332417" transform={`rotate(22 ${cx + 7} ${logY - 5})`} />
        </>
      ) : (
        <>
          <ellipse cx={cx} cy={logY + 2} rx={glowR} ry={6 + size * 4} fill="#E8A320" opacity={0.12} />
          <rect x={cx - logW} y={logY - 2} width={logW * 2} height={4.5} rx={2.25} fill="#6B3A1F" />
          <rect x={cx - 9} y={logY - 10} width={4.5} height={10} rx={2.25} fill="#7C4526" transform={`rotate(-22 ${cx - 7} ${logY - 5})`} />
          <rect x={cx + 4.5} y={logY - 10} width={4.5} height={10} rx={2.25} fill="#7C4526" transform={`rotate(22 ${cx + 7} ${logY - 5})`} />
          <ellipse cx={cx} cy={logY - f1h / 2} rx={fw1} ry={f1h / 2} fill="#D85A30" opacity={alpha} />
          <ellipse cx={cx - fw2 * 0.6} cy={logY - f2h * 0.55} rx={fw2} ry={f2h / 2} fill="#E8A320" opacity={alpha} />
          <ellipse cx={cx + fw2 * 0.6} cy={logY - f2h * 0.55} rx={fw2} ry={f2h / 2} fill="#E8A320" opacity={alpha} />
          <ellipse cx={cx} cy={logY - f1h * 0.85} rx={fw1 * 0.55} ry={f3h / 2} fill="#FAC75A" opacity={0.9} />
          {size > 0.3 && (
            <ellipse cx={cx} cy={logY - f1h} rx={fw1 * 0.3} ry={f3h * 0.4} fill="#fff" opacity={0.18} />
          )}
        </>
      )}

      {/* --- HERO --- */}
      <g transform={`translate(${figureX} ${figureY}) scale(${scale})`}>
        {/* Legs + boots */}
        <rect x="12" y="33" width="6"  height="9" rx="2.4" fill={TUNIC_2} />
        <rect x="22" y="33" width="6"  height="9" rx="2.4" fill={TUNIC_2} />
        <rect x="10" y="40" width="9"  height="5" rx="2.2" fill={BOOT} />
        <rect x="21" y="40" width="9"  height="5" rx="2.2" fill={BOOT} />

        {/* Tunic */}
        <path d="M11 18 Q11 14 20 14 Q29 14 29 18 L30 35 Q20 38 10 35 Z" fill={TUNIC} />
        {/* Belt */}
        <rect x="10.5" y="29" width="19" height="3.4" rx="1.4" fill={LEATHER} />
        <rect x="18"   y="29" width="4"  height="3.4" rx="1.2" fill={GOLD} />

        {/* Arms -- raised when celebrating */}
        {celebrating ? (
          <>
            <rect x="5.6"  y="7" width="4.2" height="13" rx="2.1" fill={TUNIC} transform="rotate(-30 7.7 13.5)" />
            <rect x="30.2" y="7" width="4.2" height="13" rx="2.1" fill={TUNIC} transform="rotate(30 32.3 13.5)" />
            <circle cx="4.6"  cy="5.6" r="2.2" fill={SKIN} />
            <circle cx="35.4" cy="5.6" r="2.2" fill={SKIN} />
          </>
        ) : (
          <>
            <rect x="7.3"  y="17.5" width="4.2" height="13" rx="2.1" fill={TUNIC} transform="rotate(-5 9.4 24)" />
            <rect x="28.5" y="17.5" width="4.2" height="13" rx="2.1" fill={TUNIC} transform="rotate(5 30.6 24)" />
            <circle cx="9.1"  cy="31" r="2.2" fill={SKIN} />
            <circle cx="30.9" cy="31" r="2.2" fill={SKIN} />
          </>
        )}

        {/* Head */}
        <circle cx="20" cy="8.5" r="7" fill={SKIN} />
        {/* Jaw shading, so the face reads at small sizes */}
        <path d="M14 11 Q20 16 26 11 Q20 15.5 14 11 Z" fill={SKIN_2} opacity="0.8" />
        {/* Hair */}
        <path d="M13 7.5 Q13 1 20 1 Q27 1 27 7.5 Q23.5 4.6 20 4.9 Q16.5 4.6 13 7.5 Z" fill={HAIR} />
        {/* Eyes */}
        <circle cx="17.7" cy="8.6" r="0.95" fill="#1A1A1A" />
        <circle cx="22.3" cy="8.6" r="0.95" fill="#1A1A1A" />
      </g>
    </svg>
  )
}
