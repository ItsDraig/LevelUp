'use client'

import { Sword, Shield, Sparkles } from 'lucide-react'
import { MAGIC_MANA_COST } from '@/lib/battle'
import type { PlayerAction } from '@/types'

interface ActionBarProps {
  selected: PlayerAction
  mana: number
  onSelect: (action: PlayerAction) => void
  disabled?: boolean
}

const ACTIONS = [
  { key: 'attack' as const, label: 'Attack', Icon: Sword,    color: 'var(--cat-body)' },
  { key: 'defend' as const, label: 'Defend', Icon: Shield,   color: 'var(--cat-career)' },
  { key: 'magic'  as const, label: 'Magic',  Icon: Sparkles, color: 'var(--cat-mind)' },
]

export default function ActionBar({ selected, mana, onSelect, disabled }: ActionBarProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {ACTIONS.map(({ key, label, Icon, color }) => {
        const isSelected = selected === key
        // Magic is unselectable while short: a stance that cannot resolve is a
        // trap, and the reducer already drops back to Attack after a cast that
        // empties the bar. Casting stays a deliberate tap once mana is banked.
        const short = key === 'magic' && mana < MAGIC_MANA_COST
        const unavailable = disabled || short

        return (
          <button
            key={key}
            type="button"
            disabled={unavailable}
            onClick={() => onSelect(key)}
            className="flex flex-col items-center gap-1 rounded-2xl py-3 active:scale-[0.97]"
            style={{
              background: isSelected ? 'var(--surface3)' : 'var(--surface)',
              border: `1px solid ${isSelected ? color : 'var(--border)'}`,
              opacity: unavailable ? 0.4 : 1,
              transition: 'background 140ms ease, border-color 140ms ease, transform 100ms ease',
            }}
          >
            <Icon size={19} style={{ color: isSelected ? color : 'var(--text2)' }} />
            <span
              className="text-[11px] font-medium"
              style={{ color: isSelected ? 'var(--text)' : 'var(--text2)' }}
            >
              {label}
            </span>
            {key === 'magic' && (
              <span
                className="text-[9px] tracking-wide"
                style={{ color: short ? 'var(--cat-body)' : 'var(--text2)' }}
              >
                {MAGIC_MANA_COST} MP
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
