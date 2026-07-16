'use client'

import { useState } from 'react'
import {
  Shield, Target, Coins, HardHat, Wind, Sword, Wand2, Check,
  type LucideIcon,
} from 'lucide-react'
import { STAT_LABELS } from '@/lib/constants'
import { useCountUp } from '@/lib/useCountUp'
import { purchaseItemAction, equipWeaponAction, unequipWeaponAction } from '@/app/shop/actions'
import type { Profile, ShopItem, InventoryItem, StatKey } from '@/types'

const ICONS: Record<string, LucideIcon> = {
  shield: Shield,
  target: Target,
  coins: Coins,
  'hard-hat': HardHat,
  wind: Wind,
  sword: Sword,
  wand: Wand2,
}

const SINGLE_OWN_TYPES = new Set(['goal_slot', 'cosmetic', 'weapon'])

interface ShopClientProps {
  profile: Profile
  items: ShopItem[]
  inventory: InventoryItem[]
}

export default function ShopClient({ profile, items, inventory }: ShopClientProps) {
  const [gold, setGold] = useState(profile.gold)
  const displayGold = useCountUp(gold)
  const [owned, setOwned] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {}
    inventory.forEach(i => { m[i.shop_item_id] = i.quantity })
    return m
  })
  const [equippedId, setEquippedId] = useState<string | null>(profile.equipped_weapon_id)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function handleBuy(item: ShopItem) {
    if (pendingId) return
    setPendingId(item.id)
    setMessage(null)
    const result = await purchaseItemAction(item.id)
    setPendingId(null)
    if ('error' in result) {
      setMessage(result.error)
      return
    }
    setGold(result.newGold)
    setOwned(prev => ({ ...prev, [item.id]: (prev[item.id] ?? 0) + 1 }))
  }

  async function handleEquip(item: ShopItem) {
    if (pendingId) return
    setPendingId(item.id)
    setMessage(null)
    const result = await equipWeaponAction(item.id)
    setPendingId(null)
    if ('error' in result) {
      setMessage(result.error)
      return
    }
    setEquippedId(item.id)
  }

  async function handleUnequip() {
    if (pendingId) return
    setPendingId(equippedId)
    setMessage(null)
    await unequipWeaponAction()
    setPendingId(null)
    setEquippedId(null)
  }

  const weapons = items.filter(i => i.type === 'weapon')
  const consumables = items.filter(i => i.type === 'streak_shield' || i.type === 'task_modifier')
  const upgrades = items.filter(i => i.type === 'goal_slot')
  const cosmetics = items.filter(i => i.type === 'cosmetic')

  function meetsRequirement(item: ShopItem): boolean {
    if (!item.required_stat) return true
    const statKey = item.required_stat as StatKey
    const have = (profile as unknown as Record<StatKey, number>)[statKey] ?? 0
    return have >= (item.required_stat_value ?? 0)
  }

  function renderCard(item: ShopItem) {
    const Icon = ICONS[item.icon] ?? Coins
    const qty = owned[item.id] ?? 0
    const isWeapon = item.type === 'weapon'
    const isEquipped = isWeapon && equippedId === item.id
    const meetsReq = meetsRequirement(item)
    const isPending = pendingId === item.id
    const singleOwn = SINGLE_OWN_TYPES.has(item.type)
    const alreadyOwnedSingle = singleOwn && qty > 0

    return (
      <div
        key={item.id}
        className="rounded-2xl px-4 py-3.5 mb-2"
        style={{ background: 'var(--surface)', border: '0.5px solid var(--border)' }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--surface2)' }}
          >
            <Icon size={17} style={{ color: isEquipped ? 'var(--gold)' : 'var(--text2)' }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{item.name}</p>
              {qty > 0 && !singleOwn && (
                <span
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: 'var(--surface3)', color: 'var(--text2)' }}
                >
                  ×{qty}
                </span>
              )}
            </div>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text2)' }}>{item.description}</p>

            {isWeapon && (
              <p className="text-[10px] mt-1" style={{ color: meetsReq ? 'var(--cat-wellness)' : '#ff6060' }}>
                Requires {item.required_stat_value ?? 0} {STAT_LABELS[item.required_stat as StatKey]}
                {item.combat_power ? ` · ${item.combat_power} power` : ''}
              </p>
            )}

            <div className="flex items-center justify-between mt-2.5">
              <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--gold)' }}>
                <span
                  className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold"
                  style={{ background: 'var(--gold)', color: '#1a0f00' }}
                >G</span>
                {item.cost}
              </span>

              {qty === 0 && (
                <button
                  onClick={() => handleBuy(item)}
                  disabled={isPending || gold < item.cost}
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-full"
                  style={{
                    background: gold < item.cost ? 'var(--surface2)' : 'var(--gold)',
                    color: gold < item.cost ? 'var(--text2)' : '#1a0f00',
                    opacity: isPending ? 0.6 : 1,
                  }}
                >
                  {isPending ? '...' : 'Buy'}
                </button>
              )}

              {qty > 0 && !isWeapon && !singleOwn && (
                <button
                  onClick={() => handleBuy(item)}
                  disabled={isPending || gold < item.cost}
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-full"
                  style={{
                    background: gold < item.cost ? 'var(--surface2)' : 'var(--surface3)',
                    color: gold < item.cost ? 'var(--text2)' : 'var(--text)',
                    border: '0.5px solid var(--border2)',
                    opacity: isPending ? 0.6 : 1,
                  }}
                >
                  {isPending ? '...' : 'Buy another'}
                </button>
              )}

              {alreadyOwnedSingle && !isWeapon && (
                <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: 'var(--text2)' }}>
                  <Check size={12} /> Owned
                </span>
              )}

              {isWeapon && qty > 0 && !isEquipped && (
                <button
                  onClick={() => handleEquip(item)}
                  disabled={isPending || !meetsReq}
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-full"
                  style={{
                    background: meetsReq ? 'var(--gold)' : 'var(--surface2)',
                    color: meetsReq ? '#1a0f00' : 'var(--text2)',
                    opacity: isPending ? 0.6 : 1,
                  }}
                >
                  {isPending ? '...' : meetsReq ? 'Equip' : 'Locked'}
                </button>
              )}

              {isEquipped && (
                <button
                  onClick={handleUnequip}
                  disabled={isPending}
                  className="flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-full"
                  style={{ background: 'var(--surface3)', color: 'var(--gold)', border: '0.5px solid var(--border2)' }}
                >
                  <Check size={12} /> {isPending ? '...' : 'Equipped'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  function renderSection(title: string, list: ShopItem[]) {
    if (list.length === 0) return null
    return (
      <div className="mb-5">
        <p className="text-[10px] font-medium tracking-widest uppercase mb-2.5" style={{ color: 'var(--text2)' }}>
          {title}
        </p>
        {list.map(renderCard)}
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">

      {/* HEADER */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
        <h1 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Shop</h1>
        <div
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
          style={{ background: 'var(--surface)', border: '0.5px solid var(--border2)' }}
        >
          <div
            className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0"
            style={{ background: 'var(--gold)', color: '#1a0f00' }}
          >G</div>
          <span className="text-xs font-medium" style={{ color: 'var(--gold)' }}>{displayGold}</span>
        </div>
      </div>

      {/* ERROR MESSAGE */}
      {message && (
        <div className="px-5 pb-2 flex-shrink-0">
          <p className="text-[11px]" style={{ color: '#ff6060' }}>{message}</p>
        </div>
      )}

      {/* ITEM LIST */}
      <div className="flex-1 overflow-y-auto px-4">
        {renderSection('Weapons', weapons)}
        {renderSection('Consumables', consumables)}
        {renderSection('Upgrades', upgrades)}
        {renderSection('Cosmetics', cosmetics)}
        <div className="h-4" />
      </div>
    </div>
  )
}
