'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { CATEGORIES, CATEGORY_CONFIG, DIFFICULTY_GOLD } from '@/lib/constants'
import type { Task, Category, Difficulty } from '@/types'

type TaskData = Omit<Task, 'id' | 'user_id' | 'created_at'>

interface TaskSheetProps {
  task?: Task
  onSave: (data: TaskData) => void
  onClose: () => void
  cost?: number // only set when creating a new task; 0 = free
  saving?: boolean
  error?: string | null
}

export default function TaskSheet({ task, onSave, onClose, cost, saving, error }: TaskSheetProps) {
  const [name, setName] = useState(task?.name ?? '')
  const [category, setCategory] = useState<Category>(task?.category ?? 'Mind')
  const [difficulty, setDifficulty] = useState<Difficulty>(task?.difficulty ?? 'Medium')
  const [isRecurring, setIsRecurring] = useState(task?.is_recurring ?? true)

  const goldValue = DIFFICULTY_GOLD[difficulty]
  const canSave = name.trim().length > 0 && !saving

  function handleSave() {
    if (!canSave) return
    onSave({ name: name.trim(), category, difficulty, gold_value: goldValue, is_recurring: isRecurring })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 z-30"
        style={{ background: 'rgba(0,0,0,0.65)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 z-40 rounded-t-3xl px-5 pt-5 pb-10 flex flex-col gap-5"
        style={{ background: 'var(--surface)', border: '0.5px solid var(--border2)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
            {task ? 'Edit task' : 'New task'}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full"
            style={{ background: 'var(--surface2)' }}
          >
            <X size={15} style={{ color: 'var(--text2)' }} />
          </button>
        </div>

        {/* Name */}
        <div>
          <label className="text-[10px] font-medium tracking-widest uppercase mb-2 block" style={{ color: 'var(--text2)' }}>
            Name
          </label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="e.g. Morning run"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none placeholder:opacity-30"
            style={{
              background: 'var(--surface2)',
              border: '0.5px solid var(--border2)',
              color: 'var(--text)',
            }}
          />
        </div>

        {/* Category */}
        <div>
          <label className="text-[10px] font-medium tracking-widest uppercase mb-2 block" style={{ color: 'var(--text2)' }}>
            Category
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => {
              const cfg = CATEGORY_CONFIG[cat]
              const active = category === cat
              return (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`text-[11px] font-medium px-3 py-1.5 rounded-full ${cfg.pillClass}`}
                  style={{
                    opacity: active ? 1 : 0.35,
                    outline: active ? `1.5px solid ${cfg.color}` : 'none',
                    outlineOffset: '2px',
                  }}
                >
                  {cat}
                </button>
              )
            })}
          </div>
        </div>

        {/* Difficulty */}
        <div>
          <label className="text-[10px] font-medium tracking-widest uppercase mb-2 block" style={{ color: 'var(--text2)' }}>
            Difficulty
          </label>
          <div className="flex gap-2">
            {(['Easy', 'Medium', 'Hard'] as Difficulty[]).map(d => {
              const active = difficulty === d
              return (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className="flex-1 py-2 rounded-xl text-[11px] font-medium"
                  style={{
                    background: active ? 'var(--surface3)' : 'var(--surface2)',
                    border: `0.5px solid ${active ? 'var(--border2)' : 'var(--border)'}`,
                    color: active ? 'var(--text)' : 'var(--text2)',
                  }}
                >
                  {d}
                  <span
                    className="block text-[9px] mt-0.5"
                    style={{ color: 'var(--gold)', opacity: active ? 1 : 0.4 }}
                  >
                    +{DIFFICULTY_GOLD[d]}g
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Type */}
        <div>
          <label className="text-[10px] font-medium tracking-widest uppercase mb-2 block" style={{ color: 'var(--text2)' }}>
            Type
          </label>
          <div className="flex gap-2">
            {[
              { label: 'Habit', sub: 'repeats daily', recurring: true },
              { label: 'One-off', sub: 'done once', recurring: false },
            ].map(opt => {
              const active = isRecurring === opt.recurring
              return (
                <button
                  key={opt.label}
                  onClick={() => setIsRecurring(opt.recurring)}
                  className="flex-1 py-2 rounded-xl text-[11px] font-medium"
                  style={{
                    background: active ? 'var(--surface3)' : 'var(--surface2)',
                    border: `0.5px solid ${active ? 'var(--border2)' : 'var(--border)'}`,
                    color: active ? 'var(--text)' : 'var(--text2)',
                  }}
                >
                  {opt.label}
                  <span
                    className="block text-[9px] mt-0.5"
                    style={{ color: 'var(--text2)', opacity: active ? 0.8 : 0.4 }}
                  >
                    {opt.sub}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Cost (new tasks only) */}
        {cost !== undefined && (
          <div
            className="flex items-center justify-between rounded-xl px-4 py-2.5"
            style={{ background: 'var(--surface2)', border: '0.5px solid var(--border)' }}
          >
            <span className="text-[11px]" style={{ color: 'var(--text2)' }}>
              {cost === 0 ? 'Free task slot' : 'Cost to add this task'}
            </span>
            <span className="text-xs font-medium" style={{ color: cost === 0 ? 'var(--cat-wellness)' : 'var(--gold)' }}>
              {cost === 0 ? 'Free' : `${cost}g`}
            </span>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-[11px] text-center" style={{ color: '#ff6060' }}>{error}</p>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="w-full py-3 rounded-xl text-sm font-semibold"
          style={{
            background: canSave ? 'var(--gold)' : 'var(--surface2)',
            color: canSave ? '#1a0f00' : 'var(--text2)',
            opacity: canSave ? 1 : 0.5,
          }}
        >
          {saving ? 'Adding…' : task ? 'Save changes' : 'Add task'}
        </button>
      </div>
    </>
  )
}
