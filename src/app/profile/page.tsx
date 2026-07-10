import { redirect } from 'next/navigation'
import { Trophy, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { signOutAction } from './actions'
import Hero from '@/components/hero/Hero'
import BottomNav from '@/components/layout/BottomNav'
import { CATEGORY_CONFIG } from '@/lib/constants'
import type { Profile } from '@/types'

export default async function ProfilePage() {
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

  const memberSince = new Date(p.created_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  const categoryStats = [
    { category: 'Mind' as const, value: p.stat_mind },
    { category: 'Body' as const, value: p.stat_body },
    { category: 'Wellness' as const, value: p.stat_wellness },
    { category: 'Career' as const, value: p.stat_career },
  ].map(s => ({ ...s, ...CATEGORY_CONFIG[s.category] }))

  return (
    <div className="flex flex-col flex-1 overflow-hidden" style={{ minHeight: '100dvh' }}>
      <div className="flex flex-col flex-1 overflow-y-auto">

        {/* HEADER */}
        <div className="px-5 pt-5 pb-3 flex-shrink-0">
          <h1 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Profile</h1>
        </div>

        {/* HERO CARD */}
        <div className="flex flex-col items-center gap-2 px-5 pb-4">
          <Hero streak={p.streak} width={140} height={115} />
          <h2
            className="text-xl font-semibold tracking-wide"
            style={{ color: 'var(--text)', fontFamily: 'Georgia, serif' }}
          >
            {p.username}
          </h2>
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full"
            style={{ background: 'var(--surface)', border: '0.5px solid var(--border2)' }}
          >
            <span className="text-xs font-medium" style={{ color: 'var(--gold)' }}>Level {p.level}</span>
          </div>
          <p className="text-[11px]" style={{ color: 'var(--text2)' }}>Member since {memberSince}</p>
        </div>

        {/* TOP STATS ROW */}
        <div className="grid grid-cols-3 gap-2 px-5 pb-4">
          <div
            className="flex flex-col items-center gap-1 rounded-xl py-3"
            style={{ background: 'var(--surface)', border: '0.5px solid var(--border2)' }}
          >
            <span className="text-lg leading-none">🔥</span>
            <span className="text-sm font-medium">{p.streak}</span>
            <span className="text-[9px] tracking-widest uppercase" style={{ color: 'var(--text2)' }}>Streak</span>
          </div>
          <div
            className="flex flex-col items-center gap-1 rounded-xl py-3"
            style={{ background: 'var(--surface)', border: '0.5px solid var(--border2)' }}
          >
            <Trophy size={18} style={{ color: 'var(--gold)' }} />
            <span className="text-sm font-medium">{p.max_streak}</span>
            <span className="text-[9px] tracking-widest uppercase" style={{ color: 'var(--text2)' }}>Best streak</span>
          </div>
          <div
            className="flex flex-col items-center gap-1 rounded-xl py-3"
            style={{ background: 'var(--surface)', border: '0.5px solid var(--border2)' }}
          >
            <div
              className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold"
              style={{ background: 'var(--gold)', color: '#1a0f00' }}
            >G</div>
            <span className="text-sm font-medium">{p.gold}</span>
            <span className="text-[9px] tracking-widest uppercase" style={{ color: 'var(--text2)' }}>Gold</span>
          </div>
        </div>

        {/* CATEGORY STATS */}
        <div className="px-5 pb-4">
          <p className="text-[10px] font-medium tracking-widest uppercase mb-2.5" style={{ color: 'var(--text2)' }}>
            Stats
          </p>
          <div className="grid grid-cols-2 gap-2">
            {categoryStats.map(({ category, value, pillClass, label }) => (
              <div key={category} className={`${pillClass} rounded-xl px-3 py-2.5 flex flex-col gap-0.5`}>
                <span className="text-[10px] uppercase tracking-widest opacity-70">{label}</span>
                <span className="text-base font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1" />

        {/* SIGN OUT */}
        <div className="px-5 pb-4 flex-shrink-0">
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium"
              style={{ border: '0.5px solid var(--border2)', color: 'var(--text2)', background: 'transparent' }}
            >
              <LogOut size={15} />
              Sign out
            </button>
          </form>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
