'use client'

import { useState, useCallback } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CATEGORY_CONFIG, FREE_TASK_LIMIT, taskCreationCost } from '@/lib/constants'
import { useCountUp } from '@/lib/useCountUp'
import TaskSheet from '@/components/tasks/TaskSheet'
import { createTaskAction } from '@/app/tasks/actions'
import type { Task, Category, Profile } from '@/types'

type Filter = 'all' | 'habits' | 'oneoffs'
type TaskData = Omit<Task, 'id' | 'user_id' | 'created_at'>

interface TasksClientProps {
  initialTasks: Task[]
  profile: Profile
}

export default function TasksClient({ initialTasks, profile }: TasksClientProps) {
  const supabase = createClient()

  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [filter, setFilter] = useState<Filter>('all')
  // undefined = sheet closed, null = new task, Task = editing
  const [sheetTask, setSheetTask] = useState<Task | null | undefined>(undefined)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [gold, setGold] = useState(profile.gold)
  const displayGold = useCountUp(gold)
  const [paidTaskCount, setPaidTaskCount] = useState(profile.paid_task_count)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const nextTaskCost = tasks.length < FREE_TASK_LIMIT ? 0 : taskCreationCost(paidTaskCount)
  const freeRemaining = Math.max(0, FREE_TASK_LIMIT - tasks.length)

  const filtered = tasks.filter(t => {
    if (filter === 'habits') return t.is_recurring
    if (filter === 'oneoffs') return !t.is_recurring
    return true
  })

  const handleSave = useCallback(async (data: TaskData) => {
    if (sheetTask === null) {
      setSaving(true)
      setSaveError(null)
      const result = await createTaskAction(data)
      setSaving(false)

      if ('error' in result) {
        setSaveError(result.error)
        return
      }

      setTasks(prev => [...prev, result.task])
      setGold(result.newGold)
      if (result.goldSpent > 0) setPaidTaskCount(prev => prev + 1)
      setSheetTask(undefined)
    } else if (sheetTask) {
      // Update existing task optimistically
      setTasks(prev => prev.map(t => t.id === sheetTask.id ? { ...t, ...data } : t))
      setSheetTask(undefined)
      await supabase.from('tasks').update(data).eq('id', sheetTask.id)
    }
  }, [sheetTask, supabase])

  const handleDeleteTap = useCallback(async (id: string) => {
    if (deletingId !== id) {
      // First tap — enter confirm state, auto-clear after 3s
      setDeletingId(id)
      setTimeout(() => setDeletingId(prev => prev === id ? null : prev), 3000)
      return
    }
    // Second tap — confirmed
    setDeletingId(null)
    setTasks(prev => prev.filter(t => t.id !== id))
    await supabase.from('tasks').delete().eq('id', id)
  }, [deletingId, supabase])

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">

      {/* HEADER */}
      <div className="flex items-center justify-between px-5 pt-5 pb-1 flex-shrink-0">
        <h1 className="text-base font-semibold" style={{ color: 'var(--text)' }}>My Tasks</h1>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
            style={{ background: 'var(--surface)', border: '0.5px solid var(--border2)' }}
          >
            <div
              className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0"
              style={{ background: 'var(--gold)', color: '#1a0f00' }}
            >G</div>
            <span className="text-xs font-medium" style={{ color: 'var(--gold)' }}>{displayGold}</span>
          </div>
          <button
            onClick={() => { setSaveError(null); setSheetTask(null) }}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'var(--gold)' }}
            aria-label="Add task"
          >
            <Plus size={16} strokeWidth={2.5} style={{ color: '#1a0f00' }} />
          </button>
        </div>
      </div>

      <div className="px-5 pb-3 flex-shrink-0">
        <p className="text-[11px]" style={{ color: 'var(--text2)' }}>
          {nextTaskCost === 0
            ? `${freeRemaining} free task${freeRemaining === 1 ? '' : 's'} left`
            : `Next new task costs ${nextTaskCost}g`}
        </p>
      </div>

      {/* FILTER TABS */}
      <div className="flex gap-2 px-5 pb-3 flex-shrink-0">
        {(['all', 'habits', 'oneoffs'] as Filter[]).map(f => {
          const active = filter === f
          const label = f === 'oneoffs' ? 'One-offs' : f.charAt(0).toUpperCase() + f.slice(1)
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="text-[11px] font-medium px-3 py-1.5 rounded-full"
              style={{
                background: active ? 'var(--surface3)' : 'var(--surface)',
                border: `0.5px solid ${active ? 'var(--border2)' : 'var(--border)'}`,
                color: active ? 'var(--text)' : 'var(--text2)',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* TASK LIST */}
      <div className="flex-1 overflow-y-auto px-4">
        {filtered.length === 0 && (
          <p className="text-sm py-12 text-center" style={{ color: 'var(--text2)' }}>
            {tasks.length === 0
              ? 'No tasks yet. Tap + to add your first one.'
              : 'No tasks match this filter.'}
          </p>
        )}

        {filtered.map(task => {
          const cfg = CATEGORY_CONFIG[task.category as Category]
          const isDeleting = deletingId === task.id

          return (
            <div
              key={task.id}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-2"
              style={{
                background: isDeleting ? 'rgba(200,40,40,0.08)' : 'var(--surface)',
                border: `0.5px solid ${isDeleting ? 'rgba(255,80,80,0.25)' : 'var(--border)'}`,
                transition: 'background 0.2s, border-color 0.2s',
              }}
            >
              {/* Category accent dot */}
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: cfg.color }}
              />

              {/* Task info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                  {task.name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cfg.pillClass}`}>
                    {task.category}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--gold)' }}>
                    +{task.gold_value}g
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text2)' }}>
                    · {task.difficulty}
                  </span>
                  {task.is_recurring && (
                    <span className="text-[10px]" style={{ color: 'var(--text2)' }}>· Daily</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {!isDeleting && (
                  <button
                    onClick={() => setSheetTask(task)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg"
                    style={{ color: 'var(--text2)' }}
                    aria-label="Edit task"
                  >
                    <Pencil size={13} />
                  </button>
                )}
                <button
                  onClick={() => handleDeleteTap(task.id)}
                  className="h-7 flex items-center justify-center rounded-lg text-[10px] font-semibold"
                  style={{
                    minWidth: isDeleting ? 'auto' : '28px',
                    paddingLeft: isDeleting ? '8px' : 0,
                    paddingRight: isDeleting ? '8px' : 0,
                    color: isDeleting ? '#ff6060' : 'var(--text2)',
                    background: isDeleting ? 'rgba(255,80,80,0.12)' : 'transparent',
                  }}
                  aria-label={isDeleting ? 'Confirm delete' : 'Delete task'}
                >
                  {isDeleting ? 'Delete?' : <Trash2 size={13} />}
                </button>
              </div>
            </div>
          )
        })}

        <div className="h-4" />
      </div>

      {/* BOTTOM SHEET */}
      {sheetTask !== undefined && (
        <TaskSheet
          task={sheetTask ?? undefined}
          onSave={handleSave}
          onClose={() => setSheetTask(undefined)}
          cost={sheetTask === null ? nextTaskCost : undefined}
          saving={saving}
          error={saveError}
        />
      )}
    </div>
  )
}
