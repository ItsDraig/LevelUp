import { Category } from '@/types'

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
