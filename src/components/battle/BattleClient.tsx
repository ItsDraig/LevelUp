'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, Coins, Lock, Sparkles, Sword } from 'lucide-react'
import {
  MAGIC_MANA_COST,
  careerGoldBonusPercent,
  derivePlayerStats,
  overhealAmount,
  xpToNext,
} from '@/lib/battle'
import { useBattle } from '@/lib/useBattle'
import { useCountUp } from '@/lib/useCountUp'
import { resolveBattleAction, syncHpAction } from '@/app/battle/actions'
import ActionBar from './ActionBar'
import CombatLog from './CombatLog'
import EnemySprite from './EnemySprite'
import HealCountdown from './HealCountdown'
import HealthBar from './HealthBar'
import type { BattleResult, Enemy, Profile, ShopItem } from '@/types'

/** One "stat -> what it buys" row in the pre-fight summary. */
function StatEffect({ label, color, value }: { label: string; color: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] uppercase tracking-wider" style={{ color }}>{label}</span>
      <span className="text-[10px]" style={{ color: 'var(--text2)' }}>{value}</span>
    </div>
  )
}

interface BattleClientProps {
  profile: Profile
  weapon: ShopItem | null
  enemies: Enemy[]
  /** Stored HP with time-based regeneration already applied, from the server. */
  currentHp: number
}

export default function BattleClient({ profile, weapon, enemies, currentHp }: BattleClientProps) {
  const { state, start, select, quit } = useBattle()

  const [gold, setGold] = useState(profile.gold)
  const [xp, setXp] = useState(profile.xp)
  const [level, setLevel] = useState(profile.level)
  const [hp, setHp] = useState(currentHp)
  const [result, setResult] = useState<BattleResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const displayGold = useCountUp(gold)

  // One payout per fight. The effect below can re-run for reasons other than
  // the fight ending, so the settle is latched rather than keyed on phase.
  const settled = useRef(false)

  // Mid-fight HP heartbeat.
  //
  // Fleeing already persists HP, but that write is fire-and-forget: navigating
  // in the same instant aborts it, which restores the free-heal this was meant
  // to prevent. Closing the tab mid-fight had the same effect. A throttled
  // downward sync closes both -- HP only ever falls during combat, so these
  // writes are monotonic and the RPC ignores anything that isn't a decrease.
  const liveHp = useRef(state.playerHp)
  const lastSynced = useRef<number | null>(null)

  useEffect(() => {
    liveHp.current = state.playerHp
  }, [state.playerHp])

  useEffect(() => {
    if (state.phase !== 'fighting') return

    const id = setInterval(() => {
      const hpNow = liveHp.current
      if (lastSynced.current !== null && hpNow >= lastSynced.current) return
      lastSynced.current = hpNow
      void syncHpAction(hpNow)
    }, 5000)

    return () => clearInterval(id)
  }, [state.phase])

  const enemy = state.enemy
  const finished = state.phase === 'won' || state.phase === 'lost'

  // Recomputed from local level/xp so a mid-session level-up raises the
  // ceiling straight away rather than waiting for a reload.
  const stats = derivePlayerStats({ ...profile, level, xp }, weapon)
  const maxHp = stats.maxHp
  const overheal = overhealAmount(hp, maxHp)
  const careerBonusPct = careerGoldBonusPercent(profile.stat_career)
  const knockedOut = hp <= 0

  useEffect(() => {
    if (!finished || !enemy || settled.current) return
    settled.current = true

    const victory = state.phase === 'won'
    resolveBattleAction(enemy.key, victory, state.playerHp).then(res => {
      if ('error' in res) {
        setError(res.error)
        return
      }
      setResult(res.result)
      setGold(res.result.gold)
      setXp(res.result.xp)
      setLevel(res.result.level)
      setHp(res.result.current_hp)
    })
    // state.playerHp is intentionally read at settle time only -- adding it to
    // the deps would re-run this on every tick of the fight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, enemy, state.phase])

  function beginFight(target: Enemy) {
    settled.current = false
    lastSynced.current = null
    setResult(null)
    setError(null)
    // Level is read from local state so a level-up mid-session raises your max
    // HP immediately rather than waiting for a reload.
    start(target, { ...profile, level, xp }, weapon, hp)
  }

  function backToCamp() {
    // Fleeing mid-fight has to persist the damage taken, or retreating from a
    // losing fight would be a free full heal.
    //
    // Sent unconditionally rather than only when below max HP. Overheal puts
    // the player *above* max, so the old guard skipped the write for anyone
    // who fled after spending only their bonus -- reopening the free heal for
    // exactly the state that has the most to lose. sync_hp discards anything
    // that is not a decrease, so an unnecessary call costs nothing.
    if (state.phase === 'fighting') {
      const fled = state.playerHp
      setHp(fled)
      syncHpAction(fled).then(res => {
        if ('error' in res) setError(res.error)
      })
    }
    settled.current = false
    setResult(null)
    setError(null)
    quit()
  }

  // ---------------------------------------------------------------
  // Picker
  // ---------------------------------------------------------------
  if (state.phase === 'picking') {
    return (
      <div className="flex flex-col flex-1 overflow-y-auto">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <h1 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Battle</h1>
          <div className="flex items-center gap-1.5">
            <Coins size={14} style={{ color: 'var(--gold)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--gold)' }}>{displayGold}</span>
          </div>
        </div>

        {/* Player summary */}
        <div className="px-5 pb-4">
          <div
            className="rounded-2xl px-4 py-3.5"
            style={{ background: 'var(--surface)', border: '0.5px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>Level {level}</span>
              <span className="text-[11px]" style={{ color: 'var(--text2)' }}>
                {xp} / {xpToNext(level)} XP
              </span>
            </div>
            <HealthBar value={xp} max={xpToNext(level)} color="var(--gold)" height={5} />

            <div className="flex items-center justify-between mt-3 mb-1.5">
              <span className="text-[11px] font-medium" style={{ color: 'var(--text)' }}>HP</span>
              <span className="text-[11px]" style={{ color: 'var(--text2)' }}>
                {hp} / {maxHp}
              </span>
            </div>
            <HealthBar
              value={hp}
              max={maxHp}
              color="var(--cat-wellness)"
              overhealColor="var(--gold)"
              height={6}
            />
            <HealCountdown currentHp={hp} maxHp={maxHp} />
            {overheal > 0 && (
              <p className="text-[10px] mt-1" style={{ color: 'var(--gold)' }}>
                +{overheal} bonus HP from clearing today&apos;s tasks -- spent first, and
                it will not come back.
              </p>
            )}

            <div className="flex items-center gap-3 mt-3">
              <div className="flex items-center gap-1.5">
                <Sword size={13} style={{ color: 'var(--cat-body)' }} />
                <span className="text-[11px]" style={{ color: 'var(--text2)' }}>
                  {weapon ? weapon.name : 'Bare hands'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles size={13} style={{ color: 'var(--cat-mind)' }} />
                <span className="text-[11px]" style={{ color: 'var(--text2)' }}>
                  {MAGIC_MANA_COST} MP per cast
                </span>
              </div>
            </div>

            {/* What the four habit stats are actually buying, spelled out.
                All of this was already feeding combat maths, but nothing on
                screen said so, which made the stats read as decoration. */}
            <div
              className="grid grid-cols-2 gap-x-3 gap-y-1 mt-3 pt-3"
              style={{ borderTop: '0.5px solid var(--border)' }}
            >
              <StatEffect label="Body" color="var(--cat-body)" value={`+${profile.stat_body} dmg`} />
              <StatEffect
                label="Body"
                color="var(--cat-body)"
                value={`${Math.round((1 - stats.defendMitigation) * 100)}% blocked`}
              />
              <StatEffect label="Mind" color="var(--cat-mind)" value={`${stats.magicPower} magic`} />
              <StatEffect label="Mind" color="var(--cat-mind)" value={`${stats.maxMana} max MP`} />
              <StatEffect
                label="Wellness"
                color="var(--cat-wellness)"
                value={`${maxHp} max HP`}
              />
              <StatEffect
                label="Career"
                color="var(--cat-career)"
                value={careerBonusPct > 0 ? `+${careerBonusPct}% gold` : 'no bonus yet'}
              />
            </div>
          </div>
        </div>

        <p
          className="px-5 pb-2 text-[10px] font-medium tracking-widest uppercase"
          style={{ color: 'var(--text2)' }}
        >
          Choose your opponent
        </p>

        {knockedOut && (
          <div className="px-5 pb-2">
            <div
              className="rounded-xl px-3.5 py-2.5"
              style={{ background: 'rgba(240,153,123,0.10)', border: '1px solid var(--cat-body)' }}
            >
              <p className="text-[11px]" style={{ color: 'var(--cat-body)' }}>
                You are out of health. Rest up before fighting again.
              </p>
            </div>
          </div>
        )}

        <div className="px-5 pb-6 flex flex-col gap-2">
          {enemies.map(e => {
            // Two distinct reasons a card is unavailable, and they must not
            // be conflated: being knocked out dims every card, but only a
            // genuine level gate should claim to be one.
            const levelLocked = level < e.min_level
            const unavailable = levelLocked || knockedOut
            return (
              <button
                key={e.key}
                type="button"
                disabled={unavailable}
                onClick={() => beginFight(e)}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left active:scale-[0.99]"
                style={{
                  background: 'var(--surface)',
                  border: '0.5px solid var(--border)',
                  opacity: unavailable ? 0.55 : 1,
                  transition: 'transform 100ms ease',
                }}
              >
                <EnemySprite enemyKey={e.key} size={44} muted={unavailable} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{e.name}</p>
                  <p className="text-[11px] truncate" style={{ color: 'var(--text2)' }}>
                    {levelLocked ? `Requires level ${e.min_level}` : e.flavor}
                  </p>
                </div>
                {levelLocked ? (
                  <Lock size={15} style={{ color: 'var(--text2)' }} />
                ) : (
                  <div className="text-right flex-shrink-0">
                    <p className="text-[11px] font-medium" style={{ color: 'var(--gold)' }}>
                      +{e.gold_reward}g
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text2)' }}>+{e.xp_reward} XP</p>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  if (!enemy) return null

  // ---------------------------------------------------------------
  // Fight
  // ---------------------------------------------------------------
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-5 pt-5 pb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={backToCamp}
          className="flex items-center gap-1 text-[11px]"
          style={{ color: 'var(--text2)' }}
        >
          <ChevronLeft size={14} />
          Flee
        </button>
      </div>

      {/* Enemy */}
      <div className="px-5 pb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{enemy.name}</span>
          <span className="text-[11px]" style={{ color: 'var(--text2)' }}>
            {state.enemyHp} / {enemy.max_hp}
          </span>
        </div>
        <HealthBar
          value={state.enemyHp}
          max={enemy.max_hp}
          color="var(--cat-body)"
          charge={state.enemyCharge}
        />
      </div>

      <div className="relative flex-1 flex items-center justify-center min-h-0">
        <motion.div
          key={state.hit?.side === 'enemy' ? state.hit.id : 'enemy-idle'}
          animate={state.hit?.side === 'enemy' ? { x: [0, -6, 6, -3, 0] } : { x: 0 }}
          transition={{ duration: 0.28 }}
        >
          <EnemySprite enemyKey={enemy.key} size={120} />
        </motion.div>

        {/* Floating damage numbers */}
        <AnimatePresence>
          {state.hit && (
            <motion.span
              key={state.hit.id}
              initial={{ opacity: 0, y: 0, scale: 0.8 }}
              animate={{ opacity: 1, y: -34, scale: 1.1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="absolute text-lg font-semibold pointer-events-none"
              style={{
                top: state.hit.side === 'enemy' ? '28%' : '68%',
                color:
                  state.hit.kind === 'heal'
                    ? 'var(--cat-wellness)'
                    : state.hit.kind === 'magic'
                      ? 'var(--cat-mind)'
                      : state.hit.side === 'player'
                        ? 'var(--cat-body)'
                        : 'var(--text)',
              }}
            >
              {state.hit.kind === 'heal' ? `+${state.hit.amount}` : `-${state.hit.amount}`}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Telegraph -- the whole reason Defend exists */}
        <AnimatePresence>
          {state.telegraph && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute top-2 px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(240,153,123,0.16)', border: '1px solid var(--cat-body)' }}
            >
              <span className="text-[11px] font-medium" style={{ color: 'var(--cat-body)' }}>
                Heavy strike incoming - brace!
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Player */}
      <div className="px-5 pb-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>You</span>
          <span className="text-[11px]" style={{ color: 'var(--text2)' }}>
            {state.playerHp} / {state.stats.maxHp}
          </span>
        </div>
        <HealthBar
          value={state.playerHp}
          max={state.stats.maxHp}
          color="var(--cat-wellness)"
          overhealColor="var(--gold)"
          charge={state.playerCharge}
        />
        <div className="mt-1.5">
          <HealthBar value={state.playerMana} max={state.stats.maxMana} color="var(--cat-mind)" height={5} />
        </div>
        <HealCountdown currentHp={state.playerHp} maxHp={state.stats.maxHp} />
      </div>

      <div className="px-5 pb-3">
        <CombatLog entries={state.log} />
      </div>

      <div className="px-5 pb-4">
        <ActionBar selected={state.action} mana={state.playerMana} onSelect={select} disabled={finished} />
      </div>

      {/* Result */}
      <AnimatePresence>
        {finished && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center px-8"
            style={{ background: 'rgba(15,15,15,0.86)', backdropFilter: 'blur(3px)' }}
          >
            <motion.div
              initial={{ scale: 0.94, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full rounded-2xl px-5 py-6 flex flex-col items-center gap-3"
              style={{ background: 'var(--surface)', border: '0.5px solid var(--border2)' }}
            >
              <p
                className="text-lg font-semibold tracking-wide"
                style={{
                  fontFamily: 'Georgia, serif',
                  color: state.phase === 'won' ? 'var(--gold)' : 'var(--text2)',
                }}
              >
                {state.phase === 'won' ? 'Victory' : 'Defeated'}
              </p>

              {state.phase === 'won' && result && (
                <div className="flex flex-col items-center gap-1">
                  <p className="text-sm" style={{ color: 'var(--text)' }}>
                    +{result.gold_awarded} gold · +{result.xp_awarded} XP
                  </p>
                  {result.gold_bonus > 0 && (
                    <p className="text-[11px]" style={{ color: 'var(--cat-career)' }}>
                      includes +{result.gold_bonus}g from Career
                    </p>
                  )}
                  {result.levels_gained > 0 && (
                    <p className="text-sm font-medium" style={{ color: 'var(--gold)' }}>
                      Level {result.level}!
                    </p>
                  )}
                </div>
              )}

              {state.phase === 'lost' && (
                <p className="text-[11px] text-center" style={{ color: 'var(--text2)' }}>
                  No gold lost, but you are out of health -- resting back to full takes
                  10 hours. Try bracing when a heavy strike is telegraphed.
                </p>
              )}

              {error && <p className="text-[11px] text-center" style={{ color: 'var(--cat-body)' }}>{error}</p>}

              <div className="grid grid-cols-2 gap-2 w-full mt-2">
                <button
                  type="button"
                  onClick={backToCamp}
                  className="py-2.5 rounded-xl text-sm font-medium"
                  style={{ border: '0.5px solid var(--border2)', color: 'var(--text2)' }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => beginFight(enemy)}
                  className="py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: 'var(--gold)', color: '#1a0f00' }}
                >
                  Fight again
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
