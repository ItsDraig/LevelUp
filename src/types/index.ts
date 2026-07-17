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
