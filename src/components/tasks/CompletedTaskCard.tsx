'use client'

import { Check } from 'lucide-react'
import { TaskWithStatus } from '@/types'

interface CompletedTaskCardProps {
  task: TaskWithStatus
  onUndo: (task: TaskWithStatus) => void
}

export default function CompletedTaskCard({ task, onUndo }: CompletedTaskCardProps) {
  return (
    <div
      onClick={() => onUndo(task)}
      className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-2 cursor-pointer select-none transition-opacity"
      style={{
        background: 'var(--surface)',
        border: '0.5px solid var(--border)',
        opacity: 0.5,
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
    >
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--surface2)', border: '1.5px solid var(--border2)' }}
      >
        <Check size={13} style={{ color: 'var(--text2)' }} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium line-through" style={{ color: 'var(--text2)' }}>{task.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`cat-pill text-[10px] font-medium px-2 py-0.5 rounded-full ${task.category.toLowerCase() === 'mind' ? 'pill-mind' : task.category.toLowerCase() === 'body' ? 'pill-body' : task.category.toLowerCase() === 'wellness' ? 'pill-wellness' : task.category.toLowerCase() === 'career' ? 'pill-career' : 'pill-basic'}`}>
            {task.category}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--text2)' }}>Tap to undo</span>
        </div>
      </div>
    </div>
  )
}
