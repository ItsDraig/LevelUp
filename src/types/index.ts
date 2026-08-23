export type Category = 'Mind' | 'Body' | 'Wellness' | 'Career' | 'Basic'
export type Difficulty = 'Easy' | 'Medium' | 'Hard'

export type StatKey = 'stat_mind' | 'stat_body' | 'stat_wellness' | 'stat_career'

export interface Profile {
  id: string
  user_id: string
  username: string
  gold: number
  streak: number
  max_streak: number
  last_completed_date: string | null // ISO date string YYYY-MM-DD
  level: number
  stat_mind: number
  stat_body: number
  stat_wellness: number
  stat_career: number
  paid_task_count: number
  equipped_weapon_id: string | null
  double_gold_date: string | null // YYYY-MM-DD -- gold-doubling active for this date
  xp: number // progress toward the next level; reset by the carry on level-up
  created_at: string
}

export interface Task {
  id: string
  user_id: string
  name: string
  category: Category
  difficulty: Difficulty
  gold_value: number
  is_recurring: boolean
  created_at: string
}

export interface TaskCompletion {
  id: string
  user_id: string
  task_id: string
  completed_date: string // YYYY-MM-DD
  gold_awarded: number
  created_at: string
  task?: Task
}

export interface Goal {
  id: string
  user_id: string
  name: string
  category: Category
  description: string
  duration_days: number
  gold_reward: number
  days_contributed: number
  is_complete: boolean
  created_at: string
}

export interface ShopItem {
  id: string
  name: string
  description: string
  type: 'streak_shield' | 'goal_slot' | 'task_modifier' | 'cosmetic' | 'weapon'
  cost: number
  effect_value: number | null
  icon: string
  required_stat: StatKey | null
  required_stat_value: number | null
  combat_power: number | null
}

export interface InventoryItem {
  id: string
  user_id: string
  shop_item_id: string
  quantity: number
  shop_item?: ShopItem
}

// Used client-side only to track per-session completion state
export interface TaskWithStatus extends Task {
  completedToday: boolean
  readded: boolean // was completed then undone -- no gold on re-complete
}

// ---------------------------------------------------------------
// Battle
// ---------------------------------------------------------------

export interface Enemy {
  key: string
  name: string
  flavor: string
  max_hp: number
  attack_damage: number
  tick_ms: number
  heavy_chance: number
  recover_chance: number
  gold_reward: number
  xp_reward: number
  min_level: number
  sort_order: number
}

// The player's selected stance. It resolves on their next tick rather than
// on tap, so it can be switched freely while a tick is charging.
export type PlayerAction = 'attack' | 'defend' | 'magic'

export type EnemyMove = 'basic' | 'heavy' | 'recover'

export type BattlePhase = 'picking' | 'fighting' | 'won' | 'lost'

export interface CombatLogEntry {
  id: number
  side: 'player' | 'enemy' | 'system'
  text: string
}

// What resolve_battle() returns.
export interface BattleResult {
  gold_awarded: number
  xp_awarded: number
  gold: number
  xp: number
  level: number
  levels_gained: number
}
