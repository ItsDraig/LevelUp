import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TasksClient from '@/components/tasks/TasksClient'
import BottomNav from '@/components/layout/BottomNav'
import type { Profile, Task } from '@/types'

export default async function TasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()
  if (!profile) redirect('/auth/login')

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  return (
    <div className="flex flex-col flex-1 overflow-hidden" style={{ minHeight: '100dvh' }}>
      <TasksClient initialTasks={(tasks ?? []) as Task[]} profile={profile as Profile} />
      <BottomNav />
    </div>
  )
}
