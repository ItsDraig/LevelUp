'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { STAT_LABELS } from '@/lib/constants'
import { todayString } from '@/lib/dates'
import type { ShopItem, StatKey } from '@/types'

export type ActionResult<T extends object = object> = { error: string } | ({ success: true } & T)

// Item types the user can only ever own one of.
const SINGLE_OWN_TYPES = new Set(['goal_slot', 'cosmetic', 'weapon'])

export async function purchaseItemAction(shopItemId: string): Promise<ActionResult<{ newGold: number }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: item } = await supabase
    .from('shop_items')
    .select('*')
    .eq('id', shopItemId)
    .single()
  if (!item) return { error: 'Item not found.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('gold')
    .eq('user_id', user.id)
    .single()
  if (!profile) return { error: 'Profile not found.' }

  const { data: existing } = await supabase
    .from('inventory')
    .select('id, quantity')
    .eq('user_id', user.id)
    .eq('shop_item_id', shopItemId)
    .maybeSingle()

  if (SINGLE_OWN_TYPES.has(item.type) && existing && existing.quantity > 0) {
    return { error: 'You already own this.' }
  }

  if (profile.gold < item.cost) return { error: 'Not enough gold.' }

  const newGold = profile.gold - item.cost
  const { error: goldError } = await supabase
    .from('profiles')
    .update({ gold: newGold })
    .eq('user_id', user.id)
  if (goldError) return { error: 'Purchase failed.' }

  if (existing) {
    await supabase.from('inventory').update({ quantity: existing.quantity + 1 }).eq('id', existing.id)
  } else {
    await supabase.from('inventory').insert({ user_id: user.id, shop_item_id: shopItemId, quantity: 1 })
  }

  revalidatePath('/shop')
  return { success: true, newGold }
}

export async function equipWeaponAction(shopItemId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: item } = await supabase
    .from('shop_items')
    .select('*')
    .eq('id', shopItemId)
    .single()
  if (!item || item.type !== 'weapon') return { error: 'Not a weapon.' }

  const { data: owned } = await supabase
    .from('inventory')
    .select('quantity')
    .eq('user_id', user.id)
    .eq('shop_item_id', shopItemId)
    .maybeSingle()
  if (!owned || owned.quantity < 1) return { error: 'You do not own this weapon.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()
  if (!profile) return { error: 'Profile not found.' }

  const typedItem = item as ShopItem
  if (typedItem.required_stat) {
    const statKey = typedItem.required_stat as StatKey
    const have = (profile as Record<StatKey, number>)[statKey] ?? 0
    const need = typedItem.required_stat_value ?? 0
    if (have < need) {
      return { error: `Requires ${need} ${STAT_LABELS[statKey]} (you have ${have}).` }
    }
  }

  await supabase.from('profiles').update({ equipped_weapon_id: shopItemId }).eq('user_id', user.id)
  revalidatePath('/shop')
  revalidatePath('/profile')
  return { success: true }
}

export async function activateDoubleGoldAction(): Promise<ActionResult<{ date: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: item } = await supabase
    .from('shop_items')
    .select('id')
    .eq('type', 'task_modifier')
    .maybeSingle()
  if (!item) return { error: 'Item not found.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('double_gold_date')
    .eq('user_id', user.id)
    .single()
  if (!profile) return { error: 'Profile not found.' }

  const today = todayString()
  if (profile.double_gold_date === today) return { error: 'Already active today.' }

  const { data: owned } = await supabase
    .from('inventory')
    .select('id, quantity')
    .eq('user_id', user.id)
    .eq('shop_item_id', item.id)
    .maybeSingle()
  if (!owned || owned.quantity < 1) return { error: 'You do not own this.' }

  if (owned.quantity > 1) {
    await supabase.from('inventory').update({ quantity: owned.quantity - 1 }).eq('id', owned.id)
  } else {
    await supabase.from('inventory').delete().eq('id', owned.id)
  }

  await supabase.from('profiles').update({ double_gold_date: today }).eq('user_id', user.id)

  revalidatePath('/shop')
  revalidatePath('/home')
  return { success: true, date: today }
}

export async function unequipWeaponAction(): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  await supabase.from('profiles').update({ equipped_weapon_id: null }).eq('user_id', user.id)
  revalidatePath('/shop')
  revalidatePath('/profile')
  return { success: true }
}
