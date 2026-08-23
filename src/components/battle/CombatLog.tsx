import type { CombatLogEntry } from '@/types'

const SIDE_COLOR: Record<CombatLogEntry['side'], string> = {
  player: 'var(--text)',
  enemy:  'var(--cat-body)',
  system: 'var(--text2)',
}

export default function CombatLog({ entries }: { entries: CombatLogEntry[] }) {
  return (
    <div
      className="rounded-2xl px-3.5 py-2.5 flex flex-col gap-1 justify-end"
      style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', minHeight: 92 }}
    >
      {entries.map((e, i) => (
        <p
          key={e.id}
          className="text-[11px] leading-snug"
          style={{
            color: SIDE_COLOR[e.side],
            // Older lines recede rather than scrolling away entirely.
            opacity: 0.35 + (0.65 * (i + 1)) / entries.length,
          }}
        >
          {e.text}
        </p>
      ))}
    </div>
  )
}
