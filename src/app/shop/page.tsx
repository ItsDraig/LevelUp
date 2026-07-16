import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ShopClient from '@/components/shop/ShopClient'
import BottomNav from '@/components/layout/BottomNav'
import type { Profile, ShopItem, InventoryItem } from '@/types'

export default async function ShopPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()
  if (!profile) redirect('/auth/login')

  const { data: items } = await supabase
    .from('shop_items')
    .select('*')
    .order('cost', { ascending: true })

  const { data: inventory } = await supabase
    .from('inventory')
    .select('*')
    .eq('user_id', user.id)

  return (
    <div className="flex flex-col flex-1 overflow-hidden" style={{ minHeight: '100dvh' }}>
      <ShopClient
        profile={profile as Profile}
        items={(items ?? []) as ShopItem[]}
        inventory={(inventory ?? []) as InventoryItem[]}
      />
      <BottomNav />
    </div>
  )
}
