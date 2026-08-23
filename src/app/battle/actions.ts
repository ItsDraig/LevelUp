'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { BattleResult } from '@/types'

export type ActionResult<T extends object = object> = { error: string } | ({ success: true } & T)

/**
 * Records the outcome of a fight and pays out.
 *
 * Deliberately a thin wrapper: all the authority lives in the resolve_battle
 * RPC. The client names an enemy and reports its ending HP, never a reward --
 * the profiles update policy is row-scoped with no `with check`, so anything
 * that trusted a client-supplied payout could be written straight from the
 * browser. The RPC clamps the HP against a bound it computes itself, and
 * forces zero on a defeat.
 */
export async function resolveBattleAction(
  enemyKey: string,
  victory: boolean,
  endingHp: number,
): Promise<ActionResult<{ result: BattleResult }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data, error } = await supabase.rpc('resolve_battle', {
    p_enemy_key: enemyKey,
    p_victory: victory,
    p_ending_hp: Math.max(0, Math.round(endingHp)),
  })

  if (error) return { error: error.message }

  revalidatePath('/battle')
  revalidatePath('/home')
  revalidatePath('/profile')
  return { success: true, result: data as BattleResult }
}

/**
 * Persists HP without logging a battle -- used when fleeing.
 *
 * Without this, taking damage and walking away would be a free full heal. The
 * RPC only ever writes HP downward, so this cannot be used to top up.
 */
export async function syncHpAction(
  endingHp: number,
): Promise<ActionResult<{ currentHp: number; maxHp: number }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data, error } = await supabase.rpc('sync_hp', {
    p_hp: Math.max(0, Math.round(endingHp)),
  })

  if (error) return { error: error.message }

  // Deliberately no revalidatePath: this runs on a heartbeat during a fight,
  // and refreshing the route every few seconds would bounce the router
  // mid-combat. The client tracks HP locally and the next real navigation
  // picks up the stored value.
  const row = data as { current_hp: number; max_hp: number }
  return { success: true, currentHp: row.current_hp, maxHp: row.max_hp }
}
