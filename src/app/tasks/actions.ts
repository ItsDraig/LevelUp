'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { FREE_TASK_LIMIT, taskCreationCost } from '@/lib/constants'
import type { Task, Category, Difficulty } from '@/types'

type NewTaskInput = {
  name: string
  category: Category
  difficulty: Difficulty
  gold_value: number
  is_recurring: boolean
}

export type CreateTaskResult =
  | { error: string }
  | { success: true; task: Task; goldSpent: number; newGold: number }

export async function createTaskAction(input: NewTaskInput): Promise<CreateTaskResult> {
  const name = input.name.trim()
  if (!name) return { error: 'Name is required.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const [{ count }, { data: profile }] = await Promise.all([
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('profiles').select('gold, paid_task_count').eq('user_id', user.id).single(),
  ])
  if (!profile) return { error: 'Profile not found.' }

  const isFree = (count ?? 0) < FREE_TASK_LIMIT
  const cost = isFree ? 0 : taskCreationCost(profile.paid_task_count)

  if (!isFree && profile.gold < cost) {
    return { error: `Not enough gold -- this task costs ${cost}g.` }
  }

  const { data: inserted, error: insertError } = await supabase
    .from('tasks')
    .insert({
      user_id: user.id,
      name,
      category: input.category,
      difficulty: input.difficulty,
      gold_value: input.gold_value,
      is_recurring: input.is_recurring,
    })
    .select()
    .single()
  if (insertError || !inserted) return { error: 'Failed to create task.' }

  let newGold = profile.gold
  if (!isFree) {
    newGold = profile.gold - cost
    await supabase
      .from('profiles')
      .update({ gold: newGold, paid_task_count: profile.paid_task_count + 1 })
      .eq('user_id', user.id)
  }

  revalidatePath('/tasks')
  revalidatePath('/home')
  return { success: true, task: inserted as Task, goldSpent: cost, newGold }
}
