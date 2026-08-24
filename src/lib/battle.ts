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

/**
 * Multiplier applied to incoming damage while the player is defending, at
 * zero Body. Body improves on it -- see `defendMitigation()`.
 */
export const DEFEND_MITIGATION = 0.4

/**
 * How much of a guarded blow each point of Body shaves off, and the hard
 * floor that scaling stops at.
 *
 * The floor is the load-bearing part. Defend already pays mana as well as
 * mitigating, so an unbounded scale would eventually make bracing strictly
 * better than swinging against anything that telegraphs. At 0.15 a guarded
 * heavy still lands for 3.0 * 0.15 = 0.45x base, so eating the hit stays a
 * real cost rather than a formality. This is the HEAVY_MULTIPLIER trade being
 * protected from the opposite direction -- read that note too before touching
 * either number.
 */
export const DEFEND_MITIGATION_FLOOR = 0.15
export const DEFEND_MITIGATION_PER_BODY = 0.01

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
// Stat scaling
//
// Each habit category buys exactly one combat lever, so which tasks you
// actually do shapes how you fight:
//
//   Body     -> physical damage, and how much a raised guard absorbs
//   Mind     -> magic damage, and the size of the mana pool
//   Wellness -> max HP
//   Career   -> gold earned, everywhere
//
// Anything here that the server also needs is written in whole percents
// rather than floats, because it has to be mirrored in PL/pgSQL exactly.
// Integer division agrees between the two languages; 0.02 does not.
// ---------------------------------------------------------------

/** Max HP per point of Wellness, on top of the level curve. */
export const HP_PER_WELLNESS = 4

/** Max mana per point of Mind. */
export const MANA_PER_MIND = 3

/** Magic damage per point of Mind, in whole percent of a point. */
export const MAGIC_PER_MIND_PCT = 250

/**
 * Gold bonus per point of Career, in whole percent, and its cap.
 *
 * MIRRORED in gold_bonus_percent() in supabase/schema.sql: battle payouts are
 * computed inside resolve_battle because the profiles update policy would let
 * a client-supplied reward be written straight from the browser. Change one,
 * change the other. Integer percent exists for exactly this reason.
 */
export const CAREER_GOLD_PCT_PER_POINT = 2
export const CAREER_GOLD_BONUS_CAP_PCT = 100

/**
 * Max HP for a level and Wellness score.
 *
 * MIRRORED in hp_max() in supabase/schema.sql -- resolve_battle has to clamp
 * a client-reported HP, and a clamp trusting the client for its own bound
 * would not be a clamp.
 */
export function hpMax(level: number, wellness: number): number {
  return 60 + (Math.max(1, level) - 1) * 12 + Math.max(0, wellness) * HP_PER_WELLNESS
}

/**
 * The absolute HP ceiling, overheal included.
 *
 * Clearing the day's tasks heals a full max-HP on top of current HP, so
 * full -> 200% is the most that can ever be reached.
 * MIRRORED in hp_ceiling() in supabase/schema.sql.
 */
export function hpCeiling(maxHp: number): number {
  return maxHp * 2
}

/** Max mana for a Mind score. */
export function manaMax(mind: number): number {
  return 40 + Math.max(0, mind) * MANA_PER_MIND
}

/**
 * Incoming-damage multiplier while guarding, improved by Body.
 * Clamped at DEFEND_MITIGATION_FLOOR -- see the note there.
 */
export function defendMitigation(body: number): number {
  return Math.max(
    DEFEND_MITIGATION_FLOOR,
    DEFEND_MITIGATION - Math.max(0, body) * DEFEND_MITIGATION_PER_BODY,
  )
}

/** Career's gold bonus, in whole percent. Mirrored in SQL. */
export function careerGoldBonusPercent(career: number): number {
  return Math.min(CAREER_GOLD_BONUS_CAP_PCT, Math.max(0, career) * CAREER_GOLD_PCT_PER_POINT)
}

/**
 * Applies Career's bonus to a gold amount.
 *
 * Integer arithmetic, and floor rather than round, so this agrees to the coin
 * with the PL/pgSQL version that pays out battle gold.
 */
export function applyGoldBonus(base: number, career: number): number {
  const gold = Math.max(0, Math.floor(base))
  return gold + Math.floor((gold * careerGoldBonusPercent(career)) / 100)
}

// ---------------------------------------------------------------
// Derived player stats
// ---------------------------------------------------------------

export interface PlayerStats {
  maxHp: number
  maxMana: number
  attackPower: number
  magicPower: number
  /** Incoming-damage multiplier while guarding. Lower is better. */
  defendMitigation: number
  /** Highest HP that overheal can reach. */
  hpCeiling: number
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
  const maxHp = hpMax(profile.level, profile.stat_wellness)

  return {
    maxHp,
    hpCeiling: hpCeiling(maxHp),
    maxMana: manaMax(profile.stat_mind),
    // Bare-handed floor. Deliberately low: buying a first weapon is the early
    // progression gate, and 6 keeps an unarmed player competitive with the two
    // starter enemies without letting them skip the Shop entirely.
    attackPower: (weaponPower || 6) + profile.stat_body,
    // Base 10 keeps Magic a usable burst even at zero Mind; the per-point
    // scaling is what makes it a caster's payoff rather than a universal best.
    magicPower:
      10 +
      Math.floor((profile.stat_mind * MAGIC_PER_MIND_PCT) / 100) +
      (isCasterWeapon ? Math.floor(weaponPower * 0.5) : 0),
    defendMitigation: defendMitigation(profile.stat_body),
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
  mitigation: number = DEFEND_MITIGATION,
  rng: Rng = Math.random,
): number {
  if (move === 'recover') return 0
  const base = move === 'heavy' ? enemy.attack_damage * HEAVY_MULTIPLIER : enemy.attack_damage
  const raw = rollDamage(base, rng)
  // Never below 1: a guard that fully negated a hit would turn bracing through
  // a whole fight into a stalemate the player cannot lose.
  return playerDefending ? Math.max(1, Math.round(raw * mitigation)) : raw
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
 *
 * Regeneration tops out at maxHp. The overheal from clearing a day's tasks is
 * deliberately temporary, so resting can carry you back to full but never
 * back into the bonus. An already-overhealed value is returned untouched
 * rather than clamped to maxHp -- clamping here would silently delete the
 * bonus on the next page load, since this is what every read renders from.
 */
export function regeneratedHp(
  storedHp: number | null,
  maxHp: number,
  hpUpdatedAt: string | null,
  now: number = Date.now(),
): number {
  if (storedHp === null || storedHp === undefined) return maxHp

  const stored = Math.max(0, Math.min(hpCeiling(maxHp), storedHp))
  // At or above full there is nothing to accrue, and this is also the guard
  // that keeps the regen path from touching overheal at all.
  if (stored >= maxHp) return stored
  if (!hpUpdatedAt) return stored

  const anchor = new Date(hpUpdatedAt).getTime()
  if (Number.isNaN(anchor)) return stored

  const elapsedHours = Math.max(0, (now - anchor) / MS_PER_HOUR)
  const healed = Math.floor(elapsedHours * HP_REGEN_FRACTION_PER_HOUR * maxHp)
  return Math.max(0, Math.min(maxHp, stored + healed))
}

// ---------------------------------------------------------------
// Task-completion overheal
//
// Clearing every task for the day heals a full max-HP, applied on top of
// current HP instead of being capped at it -- so 50% becomes 150% and 1%
// becomes 101%. The excess is a temporary buffer: it soaks damage first, and
// regeneration will never put it back.
//
// It needs no separate pool. Overheal is just HP above maxHp, which means
// every damage path in the reducer already spends it in the right order and
// `sync_hp` already persists it draining away.
// ---------------------------------------------------------------

/** HP after clearing the day's tasks: current HP plus a full max-HP heal. */
export function taskCompletionHeal(currentHp: number, maxHp: number): number {
  return Math.min(hpCeiling(maxHp), Math.max(0, currentHp) + maxHp)
}

/** The temporary portion of an HP total. Zero when not overhealed. */
export function overhealAmount(hp: number, maxHp: number): number {
  return Math.max(0, hp - maxHp)
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
