'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { TaskWithStatus } from '@/types'

interface TaskCardProps {
  task: TaskWithStatus
  onComplete: (task: TaskWithStatus) => void
  goldMultiplier?: number
}

export default function TaskCard({ task, onComplete, goldMultiplier = 1 }: TaskCardProps) {
  const [checking, setChecking] = useState(false)

  function handleTap() {
    if (checking || task.completedToday) return
    setChecking(true)
    setTimeout(() => onComplete(task), 600)
  }

  const goldValue = task.gold_value * goldMultiplier
  const goldLabel = task.readded ? '+0g' : `+${goldValue}g`
  const goldColor = task.readded ? 'var(--text2)' : 'var(--gold)'

  return (
    <div
      onClick={handleTap}
      className="relative flex items-center gap-3 rounded-2xl px-4 py-3 mb-2 cursor-pointer select-none active:scale-[0.99] transition-transform"
      style={{ background: 'var(--surface)', border: '0.5px solid var(--border)' }}
    >
      {checking && !task.readded && (
        <span
          className="gold-float absolute right-4 top-1/2 text-sm font-bold pointer-events-none"
          style={{ color: 'var(--gold)' }}
        >
          +{goldValue}g
        </span>
      )}
      {/* Check bubble */}
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200"
        style={{
          border: checking ? 'none' : '1.5px solid var(--border2)',
          background: checking ? 'var(--gold)' : 'transparent',
        }}
      >
        <Check
          size={13}
          style={{
            color: '#1a0f00',
            opacity: checking ? 1 : 0,
            transition: 'opacity 0.15s',
          }}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{task.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`cat-pill text-[10px] font-medium px-2 py-0.5 rounded-full ${task.category.toLowerCase() === 'mind' ? 'pill-mind' : task.category.toLowerCase() === 'body' ? 'pill-body' : task.category.toLowerCase() === 'wellness' ? 'pill-wellness' : task.category.toLowerCase() === 'career' ? 'pill-career' : 'pill-basic'}`}>
            {task.category}
          </span>
          <span className="text-xs font-medium" style={{ color: goldColor }}>{goldLabel}</span>
          <span className="text-[11px]" style={{ color: 'var(--text2)' }}>· {task.difficulty}</span>
        </div>
      </div>
    </div>
  )
}
