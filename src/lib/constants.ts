import { Category, StatKey } from '@/types'

export const CATEGORY_CONFIG: Record<Category, {
  label: string
  pillClass: string
  statKey: 'stat_mind' | 'stat_body' | 'stat_wellness' | 'stat_career' | null
  color: string
}> = {
  Mind: {
    label: 'Mind',
    pillClass: 'pill-mind',
    statKey: 'stat_mind',
    color: '#AFA9EC',
  },
  Body: {
    label: 'Body',
    pillClass: 'pill-body',
    statKey: 'stat_body',
    color: '#F0997B',
  },
  Wellness: {
    label: 'Wellness',
    pillClass: 'pill-wellness',
    statKey: 'stat_wellness',
    color: '#5DCAA5',
  },
  Career: {
    label: 'Career',
    pillClass: 'pill-career',
    statKey: 'stat_career',
    color: '#85B7EB',
  },
  Basic: {
    label: 'Basic',
    pillClass: 'pill-basic',
    statKey: null,
    color: '#888780',
  },
}

export const DIFFICULTY_GOLD: Record<string, number> = {
  Easy: 5,
  Medium: 15,
  Hard: 25,
}

export const CATEGORIES: Category[] = ['Mind', 'Body', 'Wellness', 'Career', 'Basic']

export const STAT_LABELS: Record<StatKey, string> = {
  stat_mind: 'Mind',
  stat_body: 'Body',
  stat_wellness: 'Wellness',
  stat_career: 'Career',
}

// First FREE_TASK_LIMIT tasks are free; every task created after that costs
// gold, climbing by TASK_BASE_COST for every paid task ever purchased.
export const FREE_TASK_LIMIT = 3
export const TASK_BASE_COST = 25

export function taskCreationCost(paidTaskCount: number): number {
  return TASK_BASE_COST * (paidTaskCount + 1)
}
