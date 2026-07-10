import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { todayString, isStreakAlive } from '@/lib/dates'
import HomeClient from '@/components/tasks/HomeClient'
import BottomNav from '@/components/layout/BottomNav'
import type { Profile, Task, TaskWithStatus } from '@/types'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const today = todayString()

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/auth/login')

  // Reset streak if user missed yesterday
  if (profile.last_completed_date && !isStreakAlive(profile.last_completed_date)) {
    await supabase.from('profiles').update({ streak: 0 }).eq('user_id', user.id)
    profile.streak = 0
  }

  // Fetch all active tasks
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  // Fetch today's completions
  const { data: completions } = await supabase
    .from('task_completions')
    .select('task_id')
    .eq('user_id', user.id)
    .eq('completed_date', today)

  const completedTodayIds = new Set((completions ?? []).map((c: { task_id: string }) => c.task_id))

  // Merge into TaskWithStatus -- recurring tasks always show, one-offs only if not done
  const tasksWithStatus: TaskWithStatus[] = (tasks ?? [])
    .filter((t: Task) => t.is_recurring || !completedTodayIds.has(t.id))
    .map((t: Task) => ({
      ...t,
      completedToday: completedTodayIds.has(t.id),
      readded: false,
    }))

  return (
    <div className="flex flex-col flex-1 overflow-hidden" style={{ minHeight: '100dvh' }}>
      <HomeClient profile={profile as Profile} initialTasks={tasksWithStatus} />
      <BottomNav />
    </div>
  )
}
