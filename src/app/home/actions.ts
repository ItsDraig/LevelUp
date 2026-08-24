'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { TaskHealResult } from '@/types'

export type HealActionResult = { error: string } | { success: true; result: TaskHealResult }

/**
 * Claims the reward for clearing every task for the day: a full max-HP of
 * healing on top of current HP, the excess kept as temporary overheal.
 *
 * A thin wrapper on purpose. This is the only upward HP write in the app --
 * every other path is downward-only, which is what makes time-based
 * regeneration safe to derive on read -- so none of its authority lives here.
 * grant_task_completion_heal re-checks the completion rows itself rather than
 * believing the caller, bounds the date against the server's own, and requires
 * it to be later than the last heal. The date is passed because completion
 * rows are keyed by the client's local day (todayString()), which is not
 * necessarily the server's.
 *
 * `healed: false` comes back as a success: already-claimed and
 * not-actually-finished are both normal states for this to be called in, and
 * the caller only needs to know whether to show the reward.
 */
export async function grantTaskCompletionHealAction(date: string): Promise<HealActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data, error } = await supabase.rpc('grant_task_completion_heal', { p_date: date })
  if (error) return { error: error.message }

  const result = data as TaskHealResult

  // Only worth a revalidate when HP actually moved -- /battle reads HP on the
  // server, so it would otherwise keep rendering the pre-heal figure.
  if (result.healed) {
    revalidatePath('/battle')
    revalidatePath('/profile')
  }

  return { success: true, result }
}
