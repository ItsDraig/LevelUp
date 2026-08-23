interface EnemySpriteProps {
  enemyKey: string
  size?: number
  /** Dims and desaturates -- used for locked entries in the picker. */
  muted?: boolean
}

const PALETTE: Record<string, { body: string; dark: string; accent: string }> = {
  slime:  { body: '#5DCAA5', dark: '#2E7A61', accent: '#0F0F0F' },
  goblin: { body: '#8FBF6A', dark: '#4E6E38', accent: '#F0997B' },
  wolf:   { body: '#9A9AA8', dark: '#5A5A66', accent: '#F0997B' },
  bandit: { body: '#C08A5E', dark: '#6E4A2E', accent: '#85B7EB' },
  golem:  { body: '#8A8A82', dark: '#4E4E48', accent: '#AFA9EC' },
}

/**
 * Hand-rolled SVG creatures, in the same register as Hero.tsx's stick figure
 * -- no asset pipeline, and the art stays consistent as the roster grows.
 */
export default function EnemySprite({ enemyKey, size = 96, muted = false }: EnemySpriteProps) {
  const c = PALETTE[enemyKey] ?? PALETTE.slime

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      style={{ opacity: muted ? 0.35 : 1, filter: muted ? 'grayscale(1)' : undefined }}
      aria-hidden="true"
    >
      {enemyKey === 'slime' && (
        <>
          <path d="M10 46 Q10 22 32 22 Q54 22 54 46 Z" fill={c.body} />
          <ellipse cx="32" cy="46" rx="22" ry="5" fill={c.dark} />
          <circle cx="25" cy="37" r="3" fill={c.accent} />
          <circle cx="39" cy="37" r="3" fill={c.accent} />
          <path d="M27 44 Q32 47 37 44" stroke={c.accent} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </>
      )}

      {enemyKey === 'goblin' && (
        <>
          <path d="M18 26 L10 18 L20 20 Z" fill={c.dark} />
          <path d="M46 26 L54 18 L44 20 Z" fill={c.dark} />
          <circle cx="32" cy="28" r="12" fill={c.body} />
          <circle cx="27" cy="26" r="2.4" fill="#0F0F0F" />
          <circle cx="37" cy="26" r="2.4" fill="#0F0F0F" />
          <path d="M27 34 L37 34" stroke="#0F0F0F" strokeWidth="1.6" strokeLinecap="round" />
          <rect x="26" y="40" width="12" height="14" rx="3" fill={c.dark} />
          <rect x="42" y="34" width="4" height="20" rx="2" fill={c.accent} transform="rotate(18 44 44)" />
        </>
      )}

      {enemyKey === 'wolf' && (
        <>
          <path d="M14 44 Q12 30 26 30 L44 30 Q52 30 52 40 L52 48 L46 48 L46 42 L22 42 L22 48 L16 48 Z" fill={c.body} />
          <path d="M44 30 L40 18 L50 24 L58 20 L54 32 Z" fill={c.body} />
          <circle cx="50" cy="26" r="2.2" fill={c.accent} />
          <path d="M54 30 L60 32 L54 34 Z" fill={c.dark} />
          <path d="M14 44 Q6 40 8 32" stroke={c.dark} strokeWidth="4" fill="none" strokeLinecap="round" />
        </>
      )}

      {enemyKey === 'bandit' && (
        <>
          <path d="M16 22 Q32 12 48 22 L48 25 L16 25 Z" fill={c.dark} />
          <circle cx="32" cy="30" r="10" fill={c.body} />
          <rect x="22" y="28" width="20" height="5" rx="1.5" fill={c.accent} />
          <rect x="24" y="40" width="16" height="16" rx="4" fill={c.dark} />
          <rect x="42" y="30" width="3.5" height="24" rx="1.75" fill="#CFCFD6" transform="rotate(20 44 42)" />
        </>
      )}

      {enemyKey === 'golem' && (
        <>
          <rect x="20" y="14" width="24" height="18" rx="4" fill={c.body} />
          <rect x="16" y="34" width="32" height="22" rx="5" fill={c.dark} />
          <rect x="8"  y="36" width="8" height="16" rx="3" fill={c.body} />
          <rect x="48" y="36" width="8" height="16" rx="3" fill={c.body} />
          <circle cx="27" cy="23" r="2.6" fill={c.accent} />
          <circle cx="37" cy="23" r="2.6" fill={c.accent} />
          <path d="M22 44 L30 40 L38 46 L44 42" stroke={c.body} strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}
