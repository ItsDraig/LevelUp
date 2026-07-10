'use client'

import { useState, useCallback, useEffect } from 'react'
import { ChevronDown, ChevronUp, Check } from 'lucide-react'
import Hero from '@/components/hero/Hero'
import TaskCard from '@/components/tasks/TaskCard'
import CompletedTaskCard from '@/components/tasks/CompletedTaskCard'
import { createClient } from '@/lib/supabase/client'
import { todayString, completedToday } from '@/lib/dates'
import { CATEGORY_CONFIG } from '@/lib/constants'
import type { Profile, TaskWithStatus } from '@/types'

interface HomeClientProps {
  profile: Profile
  initialTasks: TaskWithStatus[]
}

export default function HomeClient({ profile, initialTasks }: HomeClientProps) {
  const supabase = createClient()

  const [gold, setGold] = useState(profile.gold)
  const [streak] = useState(profile.streak)
  const [activeTasks, setActiveTasks] = useState<TaskWithStatus[]>(
    initialTasks.filter(t => !t.completedToday)
  )
  const [completedTasks, setCompletedTasks] = useState<TaskWithStatus[]>(
    initialTasks.filter(t => t.completedToday)
  )
  const [completedOpen, setCompletedOpen] = useState(false)
  const [victoryVisible, setVictoryVisible] = useState(false)
  const [sessionGains, setSessionGains] = useState<Record<string, number>>({})
  const [dayAlreadyCompleted, setDayAlreadyCompleted] = useState(
    () => completedToday(profile.last_completed_date)
  )
  const [dayToast, setDayToast] = useState<'hidden' | 'visible' | 'fading'>('hidden')

  useEffect(() => {
    if (dayToast === 'visible') {
      const t = setTimeout(() => setDayToast('fading'), 1600)
      return () => clearTimeout(t)
    }
    if (dayToast === 'fading') {
      const t = setTimeout(() => setDayToast('hidden'), 400)
      return () => clearTimeout(t)
    }
  }, [dayToast])

  const handleComplete = useCallback(async (task: TaskWithStatus) => {
    const goldEarned = task.readded ? 0 : task.gold_value
    const today = todayString()

    // Optimistically update UI
    setActiveTasks(prev => prev.filter(t => t.id !== task.id))
    setCompletedTasks(prev => [{ ...task, completedToday: true }, ...prev])

    if (goldEarned > 0) {
      setGold(prev => prev + goldEarned)
      setSessionGains(prev => ({
        ...prev,
        [task.category]: (prev[task.category] ?? 0) + goldEarned,
      }))
    }

    // Persist to Supabase
    try {
      // Record completion
      await supabase.from('task_completions').upsert({
        user_id: profile.user_id,
        task_id: task.id,
        completed_date: today,
        gold_awarded: goldEarned,
      }, { onConflict: 'task_id,completed_date' })

      // Update profile gold + stat
      const statKey = CATEGORY_CONFIG[task.category].statKey
      const updates: Record<string, unknown> = { gold: gold + goldEarned }
      if (statKey && !task.readded) updates[statKey] = (profile[statKey] ?? 0) + 1

      await supabase.from('profiles').update(updates).eq('user_id', profile.user_id)
    } catch (e) {
      console.error('Failed to save completion:', e)
    }

    // Check if all tasks done
    setActiveTasks(prev => {
      if (prev.length === 0) {
        setTimeout(async () => {
          if (dayAlreadyCompleted) {
            // Complete screen already shown today (e.g. task was undone and
            // redone) -- just flash a small confirmation instead.
            setDayToast('visible')
            return
          }
          // Mark streak + last_completed_date
          const newStreak = streak + 1
          await supabase.from('profiles').update({
            last_completed_date: today,
            streak: newStreak,
            max_streak: Math.max(profile.max_streak, newStreak),
          }).eq('user_id', profile.user_id)
          setDayAlreadyCompleted(true)
          setVictoryVisible(true)
        }, 400)
      }
      return prev
    })
  }, [gold, profile, streak, supabase, dayAlreadyCompleted])

  const handleUndo = useCallback(async (task: TaskWithStatus) => {
    const today = todayString()

    setCompletedTasks(prev => prev.filter(t => t.id !== task.id))
    setActiveTasks(prev => [...prev, { ...task, completedToday: false, readded: true }])

    // Reverse gold if it was awarded
    if (!task.readded) {
      setGold(prev => prev - task.gold_value)
      setSessionGains(prev => ({
        ...prev,
        [task.category]: Math.max(0, (prev[task.category] ?? 0) - task.gold_value),
      }))
      await supabase.from('profiles').update({ gold: gold - task.gold_value }).eq('user_id', profile.user_id)
    }

    // Remove the completion record
    await supabase.from('task_completions')
      .delete()
      .eq('task_id', task.id)
      .eq('completed_date', today)
  }, [gold, profile.user_id, supabase])

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">

      {/* TOP BAR */}
      <div className="flex items-center justify-between px-5 pt-5 pb-2 flex-shrink-0">
        <div
          className="flex items-center gap-2 rounded-full px-3 py-1.5"
          style={{ background: 'var(--surface)', border: '0.5px solid var(--border2)' }}
        >
          <span className="text-lg leading-none">🔥</span>
          <div>
            <div className="text-sm font-medium leading-none">{streak}</div>
            <div className="text-[9px] tracking-widest mt-0.5" style={{ color: 'var(--text2)', fontFamily: 'Georgia, serif' }}>
              DAY STREAK
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5" style={{ color: 'var(--gold)' }}>
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{ background: 'var(--gold)', color: '#1a0f00' }}
          >G</div>
          <span className="text-sm font-medium">{gold}</span>
        </div>
      </div>

      {/* HERO */}
      <div className="flex flex-col items-center gap-1 px-5 pb-3 flex-shrink-0">
        <Hero streak={streak} />
        <p className="text-[11px] tracking-wide" style={{ color: 'var(--text2)' }}>
          Level {profile.level} · <span style={{ color: 'var(--gold)', fontWeight: 500 }}>Hero</span>
        </p>
      </div>

      {/* TASK LISTS */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4">
        <p className="text-[10px] font-medium tracking-widest uppercase mb-2.5 mt-1" style={{ color: 'var(--text2)' }}>
          Today&apos;s tasks
        </p>

        {activeTasks.length === 0 && completedTasks.length === 0 && (
          <p className="text-sm py-8 text-center" style={{ color: 'var(--text2)' }}>
            No tasks yet. Add some in the Tasks tab.
          </p>
        )}

        {activeTasks.map(task => (
          <TaskCard key={task.id} task={task} onComplete={handleComplete} />
        ))}

        {/* COMPLETED SECTION */}
        {completedTasks.length > 0 && (
          <>
            <button
              onClick={() => setCompletedOpen(o => !o)}
              className="flex items-center justify-between w-full mt-2 mb-2.5 py-1 select-none"
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium tracking-widest uppercase" style={{ color: 'var(--text2)' }}>
                  Completed
                </span>
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--surface2)', border: '0.5px solid var(--border2)', color: 'var(--text2)' }}
                >
                  {completedTasks.length}
                </span>
              </div>
              {completedOpen
                ? <ChevronUp size={14} style={{ color: 'var(--text2)' }} />
                : <ChevronDown size={14} style={{ color: 'var(--text2)' }} />
              }
            </button>

            {completedOpen && completedTasks.map(task => (
              <CompletedTaskCard key={task.id} task={task} onUndo={handleUndo} />
            ))}
          </>
        )}

        <div className="h-4" />
      </div>

      {/* DAY ALREADY COMPLETED TOAST */}
      {dayToast !== 'hidden' && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3.5 py-2 rounded-full z-30 transition-opacity duration-[400ms]"
          style={{
            background: 'var(--surface)',
            border: '0.5px solid var(--border2)',
            opacity: dayToast === 'visible' ? 1 : 0,
          }}
        >
          <Check size={13} style={{ color: 'var(--gold)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>Day completed</span>
        </div>
      )}

      {/* VICTORY OVERLAY */}
      {victoryVisible && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center px-7 gap-5 z-20 rounded-[28px]"
          style={{ background: 'var(--bg)' }}
        >
          <p className="text-[11px] tracking-[0.18em] uppercase" style={{ color: 'var(--text2)', fontFamily: 'Georgia, serif' }}>
            Day {streak + 1}
          </p>
          <h2 className="text-3xl font-semibold tracking-wide" style={{ color: 'var(--gold)', fontFamily: 'Georgia, serif' }}>
            Complete!
          </h2>

          <Hero streak={streak + 1} celebrating width={180} height={155} />

          <p className="text-sm" style={{ color: 'var(--text2)' }}>All tasks done for today.</p>

          {/* XP gains */}
          {Object.keys(sessionGains).length > 0 && (
            <div className="grid grid-cols-2 gap-2 w-full">
              {Object.entries(sessionGains).filter(([, v]) => v > 0).map(([cat, xp]) => {
                const cls = cat.toLowerCase()
                return (
                  <div key={cat} className={`pill-${cls} rounded-xl px-3 py-2 flex flex-col gap-0.5`}>
                    <span className="text-[10px] uppercase tracking-widest opacity-70">{cat}</span>
                    <span className="text-xs font-medium">+{xp} xp</span>
                  </div>
                )
              })}
            </div>
          )}

          <div
            className="w-full rounded-xl px-4 py-3 text-sm text-left"
            style={{ background: 'var(--surface)', border: '0.5px solid var(--border2)', color: 'var(--text2)', lineHeight: 1.6 }}
          >
            <strong style={{ color: 'var(--text)' }}>Come back tomorrow</strong> to keep your streak alive.
            Your tasks reset at midnight.
          </div>

          <button
            onClick={() => setVictoryVisible(false)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium"
            style={{ border: '0.5px solid var(--border2)', color: 'var(--text2)', background: 'transparent' }}
          >
            Back to home
          </button>
        </div>
      )}
    </div>
  )
}
