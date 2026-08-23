import {
  PLAYER_TICK_MS,
  RECOVER_FRACTION,
  derivePlayerStats,
  pickEnemyMove,
  resolveEnemyDamage,
  resolvePlayerAction,
  type PlayerStats,
  type Rng,
} from './battle'
import type { BattlePhase, CombatLogEntry, Enemy, PlayerAction, Profile, ShopItem } from '@/types'

const LOG_LIMIT = 6

/** A landed hit, surfaced for the floating damage numbers. */
export interface HitMarker {
  id: number
  side: 'player' | 'enemy'
  amount: number
  kind: 'basic' | 'heavy' | 'magic' | 'heal'
}

export interface BattleState {
  phase: BattlePhase
  enemy: Enemy | null
  stats: PlayerStats
  playerHp: number
  playerMana: number
  enemyHp: number
  /** Selected stance -- resolves on the next player tick. */
  action: PlayerAction
  /** Mitigation from the last resolved Defend, active until the next tick. */
  defending: boolean
  /** Enemy announced a heavy last tick and will land it on this one. */
  telegraph: boolean
  playerCharge: number
  enemyCharge: number
  log: CombatLogEntry[]
  hit: HitMarker | null
  seq: number
}

export type BattleEvent =
  | { type: 'start'; enemy: Enemy; profile: Profile; weapon: ShopItem | null }
  | { type: 'select'; action: PlayerAction }
  | { type: 'tick'; deltaMs: number; rng?: Rng }
  | { type: 'quit' }

const EMPTY_STATS: PlayerStats = { maxHp: 0, maxMana: 0, attackPower: 0, magicPower: 0 }

export const initialBattleState: BattleState = {
  phase: 'picking',
  enemy: null,
  stats: EMPTY_STATS,
  playerHp: 0,
  playerMana: 0,
  enemyHp: 0,
  action: 'attack',
  defending: false,
  telegraph: false,
  playerCharge: 0,
  enemyCharge: 0,
  log: [],
  hit: null,
  seq: 0,
}

function withLog(state: BattleState, side: CombatLogEntry['side'], text: string): BattleState {
  const entry: CombatLogEntry = { id: state.seq, side, text }
  return {
    ...state,
    seq: state.seq + 1,
    log: [...state.log, entry].slice(-LOG_LIMIT),
  }
}

export function battleReducer(state: BattleState, event: BattleEvent): BattleState {
  switch (event.type) {
    case 'start': {
      const stats = derivePlayerStats(event.profile, event.weapon)
      return {
        ...initialBattleState,
        phase: 'fighting',
        enemy: event.enemy,
        stats,
        playerHp: stats.maxHp,
        // Starting on a partial bar means the opening Magic needs earning.
        playerMana: Math.min(stats.maxMana, Math.round(stats.maxMana * 0.4)),
        enemyHp: event.enemy.max_hp,
        log: [{ id: 0, side: 'system', text: `${event.enemy.name} blocks your path.` }],
        seq: 1,
      }
    }

    case 'select':
      if (state.phase !== 'fighting') return state
      return { ...state, action: event.action }

    case 'quit':
      return initialBattleState

    case 'tick': {
      if (state.phase !== 'fighting' || !state.enemy) return state

      const rng = event.rng ?? Math.random
      const enemy = state.enemy
      let next: BattleState = { ...state }

      next.playerCharge += event.deltaMs / PLAYER_TICK_MS
      next.enemyCharge += event.deltaMs / enemy.tick_ms

      // --- Player tick -------------------------------------------------
      if (next.playerCharge >= 1) {
        next.playerCharge -= 1

        const outcome = resolvePlayerAction(next.action, next.stats, next.playerMana, rng)
        next.defending = outcome.defending
        next.playerMana = Math.max(0, Math.min(next.stats.maxMana, next.playerMana + outcome.manaDelta))

        if (outcome.defending) {
          next = withLog(next, 'player', 'You brace behind your guard.')
        } else if (next.action === 'magic' && outcome.damage === 0) {
          // Selected Magic but the mana ran out before the tick resolved.
          next = withLog(next, 'player', 'Not enough mana -- the spell fizzles.')
        } else {
          next.enemyHp = Math.max(0, next.enemyHp - outcome.damage)
          next.hit = {
            id: next.seq,
            side: 'enemy',
            amount: outcome.damage,
            kind: next.action === 'magic' ? 'magic' : 'basic',
          }
          next = withLog(
            next,
            'player',
            next.action === 'magic'
              ? `Your spell sears ${enemy.name} for ${outcome.damage}.`
              : `You strike ${enemy.name} for ${outcome.damage}.`,
          )
        }

        if (next.enemyHp <= 0) {
          return withLog({ ...next, phase: 'won' }, 'system', `${enemy.name} is defeated.`)
        }
      }

      // --- Enemy tick --------------------------------------------------
      if (next.enemyCharge >= 1) {
        next.enemyCharge -= 1

        if (next.telegraph) {
          // The wind-up announced last tick always follows through.
          next.telegraph = false
          const damage = resolveEnemyDamage(enemy, 'heavy', next.defending, rng)
          next.playerHp = Math.max(0, next.playerHp - damage)
          next.hit = { id: next.seq, side: 'player', amount: damage, kind: 'heavy' }
          next = withLog(
            next,
            'enemy',
            next.defending
              ? `You absorb the heavy blow -- ${damage} through your guard.`
              : `${enemy.name} lands a heavy blow for ${damage}!`,
          )
        } else {
          const move = pickEnemyMove(enemy, false, rng)

          if (move === 'heavy') {
            // Heavies cost the enemy this turn -- that trade is what pays for
            // the 1.8x, and it's the window Defend exists for.
            next.telegraph = true
            next = withLog(next, 'enemy', `${enemy.name} winds up for a heavy strike...`)
          } else if (move === 'recover') {
            const healed = Math.round(enemy.max_hp * RECOVER_FRACTION)
            next.enemyHp = Math.min(enemy.max_hp, next.enemyHp + healed)
            next.hit = { id: next.seq, side: 'enemy', amount: healed, kind: 'heal' }
            next = withLog(next, 'enemy', `${enemy.name} shrugs off ${healed} damage.`)
          } else {
            const damage = resolveEnemyDamage(enemy, 'basic', next.defending, rng)
            next.playerHp = Math.max(0, next.playerHp - damage)
            next.hit = { id: next.seq, side: 'player', amount: damage, kind: 'basic' }
            next = withLog(next, 'enemy', `${enemy.name} hits you for ${damage}.`)
          }
        }

        if (next.playerHp <= 0) {
          return withLog({ ...next, phase: 'lost' }, 'system', 'You black out and wake up at camp.')
        }
      }

      return next
    }

    default:
      return state
  }
}
