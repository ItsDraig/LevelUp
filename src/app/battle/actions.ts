'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { BattleResult } from '@/types'

export type ActionResult<T extends object = object> = { error: string } | ({ success: true } & T)

/**
 * Records the outcome of a fight and pays out.
 *
 * Deliberately a thin wrapper: all the authority lives in the resolve_battle
 * RPC. The client names an enemy, never an amount -- the profiles update
 * policy is row-scoped with no `with check`, so anything that trusted a
 * client-supplied reward could be written straight from the browser.
 */
export async function resolveBattleAction(
  enemyKey: string,
  victory: boolean,
): Promise<ActionResult<{ result: BattleResult }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data, error } = await supabase.rpc('resolve_battle', {
    p_enemy_key: enemyKey,
    p_victory: victory,
  })

  if (error) return { error: error.message }

  revalidatePath('/battle')
  revalidatePath('/home')
  revalidatePath('/profile')
  return { success: true, result: data as BattleResult }
}
