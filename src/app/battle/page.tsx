import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { derivePlayerStats, regeneratedHp } from '@/lib/battle'
import BattleClient from '@/components/battle/BattleClient'
import type { Enemy, Profile, ShopItem } from '@/types'

export default async function BattlePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/auth/login')

  const p = profile as Profile

  let weapon: ShopItem | null = null
  if (p.equipped_weapon_id) {
    const { data } = await supabase
      .from('shop_items')
      .select('*')
      .eq('id', p.equipped_weapon_id)
      .maybeSingle()
    weapon = (data as ShopItem) ?? null
  }

  const { data: enemies } = await supabase
    .from('enemies')
    .select('*')
    .order('sort_order', { ascending: true })

  // Resolve time-based regeneration here rather than in the client, so the
  // number the page renders is the same one the RPC will clamp against.
  const { maxHp } = derivePlayerStats(p, weapon)
  const currentHp = regeneratedHp(p.current_hp, maxHp, p.hp_updated_at)

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      <BattleClient
        profile={p}
        weapon={weapon}
        enemies={(enemies ?? []) as Enemy[]}
        currentHp={currentHp}
      />
    </div>
  )
}
