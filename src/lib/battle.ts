import type { Enemy, EnemyMove, PlayerAction, Profile, ShopItem } from '@/types'

// ---------------------------------------------------------------
// Tuning
//
// The three actions have to each be worth pressing, which they only are
// because of the mana economy: Defend is the only fast way to refill it,
// and Magic is the only thing that spends it. So the loop is bank -> burst
// -> filler, and the enemy's telegraph tells you when banking is free.
// ---------------------------------------------------------------

export const PLAYER_TICK_MS = 2400

export const MAGIC_MANA_COST = 18
export const ATTACK_MANA_GAIN = 3
export const DEFEND_MANA_GAIN = 12

/** Multiplier applied to incoming damage while the player is defending. */
export const DEFEND_MITIGATION = 0.4

/**
 * A telegraphed heavy lands for this much of the enemy's base damage.
 *
 * This MUST stay above 2.0. Winding up costs the enemy its whole turn, so at
 * 2.0 a heavy is exactly break-even with two basics and the telegraph becomes
 * a gift rather than a threat -- which makes Defend pointless and collapses
 * the whole loop into attack-spam. Simulated at 1.8 and mindless attacking
 * beat correct play; at 3.0 an untanked heavy is a genuine spike.
 */
export const HEAVY_MULTIPLIER = 3.0

/** Enemy self-heal, as a fraction of its max HP. */
export const RECOVER_FRACTION = 0.08

/** Damage rolls land within +/- this fraction of the base value. */
export const DAMAGE_VARIANCE = 0.15

// ---------------------------------------------------------------
// Derived player stats
// ---------------------------------------------------------------

export interface PlayerStats {
  maxHp: number
  maxMana: number
  attackPower: number
  magicPower: number
}

/**
 * Battle-relevant numbers derived from the profile and equipped weapon.
 *
 * Note the split: a weapon's combat_power feeds physical attack, but a
 * mind-gated weapon (the Arcane Staff) also lends half its power to magic,
 * so a caster build has something worth equipping.
 */
export function derivePlayerStats(profile: Profile, weapon: ShopItem | null): PlayerStats {
  const weaponPower = weapon?.combat_power ?? 0
  const isCasterWeapon = weapon?.required_stat === 'stat_mind'

  return {
    maxHp: 60 + (profile.level - 1) * 12 + profile.stat_wellness * 4,
    maxMana: 40 + profile.stat_mind * 3,
    // Bare-handed floor. Deliberately low: buying a first weapon is the early
    // progression gate, and 6 keeps an unarmed player competitive with the two
    // starter enemies without letting them skip the Shop entirely.
    attackPower: (weaponPower || 6) + profile.stat_body,
    // Base 10 keeps Magic a usable burst even at zero Mind; the per-point
    // scaling is what makes it a caster's payoff rather than a universal best.
    magicPower: 10 + Math.floor(profile.stat_mind * 2.5) + (isCasterWeapon ? Math.floor(weaponPower * 0.5) : 0),
  }
}

// ---------------------------------------------------------------
// Rolls
//
// Every function taking randomness takes an injectable rng so the loop can
// be driven deterministically in tests.
// ---------------------------------------------------------------

export type Rng = () => number

/** Applies variance to a base damage figure. Never rolls below 1. */
export function rollDamage(base: number, rng: Rng = Math.random): number {
  const factor = 1 + (rng() * 2 - 1) * DAMAGE_VARIANCE
  return Math.max(1, Math.round(base * factor))
}

/**
 * Damage a resolving player action deals, and what it costs.
 * Returns null damage for Defend -- it trades the swing for mitigation.
 */
export function resolvePlayerAction(
  action: PlayerAction,
  stats: PlayerStats,
  mana: number,
  rng: Rng = Math.random,
): { damage: number; manaDelta: number; defending: boolean } {
  if (action === 'defend') {
    return { damage: 0, manaDelta: DEFEND_MANA_GAIN, defending: true }
  }

  if (action === 'magic') {
    // Guarded here as well as in the UI: the stance can be selected while
    // mana is full and still be short by the time the tick resolves.
    if (mana < MAGIC_MANA_COST) {
      return { damage: 0, manaDelta: 0, defending: false }
    }
    return { damage: rollDamage(stats.magicPower, rng), manaDelta: -MAGIC_MANA_COST, defending: false }
  }

  return { damage: rollDamage(stats.attackPower, rng), manaDelta: ATTACK_MANA_GAIN, defending: false }
}

/**
 * Picks the enemy's next move. `telegraphed` is the move it announced on its
 * previous tick -- a heavy that was signalled always follows through, which is
 * what makes Defend a read rather than a coinflip.
 */
export function pickEnemyMove(enemy: Enemy, telegraphed: boolean, rng: Rng = Math.random): EnemyMove {
  if (telegraphed) return 'heavy'
  const roll = rng()
  if (roll < enemy.heavy_chance) return 'heavy'
  if (roll < enemy.heavy_chance + enemy.recover_chance) return 'recover'
  return 'basic'
}

/** Damage an enemy move deals to the player, after any Defend mitigation. */
export function resolveEnemyDamage(
  enemy: Enemy,
  move: EnemyMove,
  playerDefending: boolean,
  rng: Rng = Math.random,
): number {
  if (move === 'recover') return 0
  const base = move === 'heavy' ? enemy.attack_damage * HEAVY_MULTIPLIER : enemy.attack_damage
  const raw = rollDamage(base, rng)
  return playerDefending ? Math.max(1, Math.round(raw * DEFEND_MITIGATION)) : raw
}

// ---------------------------------------------------------------
// Leveling
// ---------------------------------------------------------------

/**
 * XP required to advance from `level` to the next one.
 * Mirrored in resolve_battle() in supabase/schema.sql -- change one, change
 * the other, or the bar on screen will disagree with what the server paid out.
 */
export function xpToNext(level: number): number {
  return 100 + (level - 1) * 60
}

// ---------------------------------------------------------------
// HP persistence and regeneration
//
// HP carries between fights. Rather than a scheduled job ticking it upward,
// `hp_updated_at` acts as an anchor and elapsed time is converted to healing
// whenever HP is read. Nothing to schedule, and it is correct for a player
// who has been away for a week.
// ---------------------------------------------------------------

/** Fraction of max HP restored per hour of rest. 10% => 10h from zero to full. */
export const HP_REGEN_FRACTION_PER_HOUR = 0.1

const MS_PER_HOUR = 3_600_000

/**
 * Stored HP plus whatever has regenerated since `hpUpdatedAt`.
 *
 * Note this does NOT advance the anchor -- callers must not persist the result
 * as a new baseline unless they also write a fresh timestamp, or partial
 * progress would be dropped on every read.
 */
export function regeneratedHp(
  storedHp: number | null,
  maxHp: number,
  hpUpdatedAt: string | null,
  now: number = Date.now(),
): number {
  if (storedHp === null || storedHp === undefined) return maxHp
  if (!hpUpdatedAt) return Math.max(0, Math.min(maxHp, storedHp))

  const anchor = new Date(hpUpdatedAt).getTime()
  if (Number.isNaN(anchor)) return Math.max(0, Math.min(maxHp, storedHp))

  const elapsedHours = Math.max(0, (now - anchor) / MS_PER_HOUR)
  const healed = Math.floor(elapsedHours * HP_REGEN_FRACTION_PER_HOUR * maxHp)
  return Math.max(0, Math.min(maxHp, storedHp + healed))
}

/**
 * Minutes of rest until HP is full.
 *
 * The maxHp terms cancel, so this is purely a function of the missing
 * fraction: empty to full is always 600 minutes regardless of how big the
 * pool is. A bigger pool heals faster in absolute HP, not in wall-clock time.
 */
export function minutesToFullHeal(currentHp: number, maxHp: number): number {
  if (maxHp <= 0 || currentHp >= maxHp) return 0
  const missingFraction = (maxHp - Math.max(0, currentHp)) / maxHp
  return Math.ceil((missingFraction / HP_REGEN_FRACTION_PER_HOUR) * 60)
}

/** "2h 24m till fully healed" / "18m till fully healed" */
export function formatHealCountdown(minutes: number): string {
  if (minutes <= 0) return ''
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  const span = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  return `${span} till fully healed`
}
