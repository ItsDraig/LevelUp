@AGENTS.md

# Project notes (for resuming work)

## Shop feature (implemented, DB migration applied)
- Weapons, gold-gated task creation, and an auto-consumed Streak Freeze are live.
  See `src/app/shop/actions.ts`, `src/app/tasks/actions.ts`,
  `src/components/shop/ShopClient.tsx`, `src/app/home/page.tsx` (streak-freeze
  consumption logic).
- Weapons require a minimum stat (`stat_mind`/`stat_body`/`stat_wellness`/`stat_career`)
  to equip, enforced server-side in `equipWeaponAction`. Seeded weapons: Wooden
  Sword, Iron Sword, Greatsword (all `stat_body`), Arcane Staff (`stat_mind`).
- Task pricing: first 3 tasks free, then `25 * (paid_task_count + 1)` gold per
  task, tracked as a lifetime counter on `profiles.paid_task_count` (never resets).
- Gold displays use `src/lib/useCountUp.ts` to animate toward the new value
  instead of jumping; `TaskCard.tsx` shows a floating "+Xg" popup
  (`.gold-float` keyframe in `globals.css`) timed to the existing 600ms
  tap-to-complete delay.
- Double Gold Day (`task_modifier` shop item) is now wired up: buying it adds
  to inventory as before, but an explicit "Activate" button in
  `ShopClient.tsx` (`activateDoubleGoldAction` in `src/app/shop/actions.ts`)
  consumes one and stamps `profiles.double_gold_date` with today's date
  (new column, migration appended to `supabase/schema.sql` — **needs to be
  run in the Supabase SQL editor**, see DB workflow gotcha below). `home/page.tsx`
  computes `doubleGoldActive` from that column and passes it down through
  `HomeClient` → `TaskCard`, doubling `gold_value` wherever gold is shown,
  earned, or undone. Effect is date-based so it naturally expires — no reset
  job needed.

## Battle system (implemented, DB migration NOT yet applied)
- Real-time tick loop in the Melvor mould: player and enemy each have their
  own attack timer, and the player picks a *stance* (Attack / Defend / Magic)
  that resolves on their next tick rather than tapping to swing.
- Pure combat math lives in `src/lib/battle.ts` (no React, injectable `rng`);
  the state machine is `src/lib/battleReducer.ts`; `src/lib/useBattle.ts` wraps
  it in a requestAnimationFrame loop. UI is `src/components/battle/*`.
- **`HEAVY_MULTIPLIER` must stay above 2.0.** Winding up costs the enemy its
  whole turn, so at 2.0 a telegraphed heavy is break-even with two basics --
  the telegraph becomes a *gift*, Defend becomes pointless, and the whole
  thing collapses into attack-spam. This was measured, not guessed: at the
  original 1.8 an always-attack bot beat correct play in 5 of 7 matchups.
- The three actions only stay distinct because of the mana economy: Defend is
  the only fast refill, Magic the only spend. Change one of
  `MAGIC_MANA_COST` / `DEFEND_MANA_GAIN` / `ATTACK_MANA_GAIN` and re-simulate
  before trusting it.
- A cast that empties the bar reverts the stance to Attack, and ActionBar
  disables Magic while short. Do **not** "simplify" this into falling back to a
  swing at resolve time -- if a short cast just attacked instead, leaving Magic
  permanently selected would be strictly optimal and the mana decision would
  stop existing. The reducer snapshots `resolvedAction` before reverting so the
  log line and damage-number colour describe the move that actually happened.
- Rewards go through the `resolve_battle` **RPC**, not a Server Action, for
  the reason already noted below re: the row-scoped profiles update policy.
  The client passes an enemy key; the RPC reads gold/xp off `public.enemies`
  so a reward amount can never be client-supplied. `battle_log` doubles as the
  rate limiter (10s minimum between resolves).
- XP/leveling is now wired: `profiles.xp` column + `xpToNext()` in
  `src/lib/battle.ts`, **mirrored** in the RPC's PL/pgSQL. Change one, change
  the other or the on-screen bar disagrees with the payout.
- Balance sim harness (throwaway, in the scratchpad, not committed) drove
  enemy tuning. Regenerate it by compiling `src/lib/battle.ts` +
  `battleReducer.ts` with `tsc --outDir` and requiring them from plain node --
  both files are React-free precisely so this works.

## PWA / installable app (set up, not yet hosted)
- Goal is eventually a real iOS App Store app. Interim step is an installable
  PWA: `src/app/manifest.ts` (`display: standalone`), `appleWebApp` +
  `viewport` exports in `src/app/layout.tsx`, and placeholder pixel-art icons
  (`public/icon-192.png`, `public/icon-512.png`, `src/app/apple-icon.png`).
- **Icons are placeholders** — a gold "level up" arrow generated
  programmatically. Redesign them as part of the retro RPG theming pass.
- `viewportFit: 'cover'` is what makes `env(safe-area-inset-*)` report
  non-zero. `BottomNav.tsx` already pads the bottom; `layout.tsx` pads the top
  because `statusBarStyle: 'black-translucent'` runs content under the notch.
  Removing `viewportFit` silently breaks both.
- `manifest.webmanifest` **must stay in the proxy matcher's exclusion list**
  (`src/proxy.ts`). Browsers fetch the manifest without credentials, so gating
  it behind the auth check redirects it to `/auth/login` and install silently
  fails. This bug was hit and fixed once already.
- Install requires **HTTPS** — the LAN URL (`http://10.0.0.100:3000`) cannot be
  added to a home screen. Needs hosting (Vercel) first. `next.config.ts` has
  `allowedDevOrigins` set to the LAN IP for phone testing over plain HTTP;
  that IP is DHCP-assigned and will need updating if it changes.
- Migrating to a bundled-offline native app (static export + Capacitor) is
  blocked by Server Actions, cookies, and proxy — all unsupported under
  `output: 'export'`. Deliberately deferred; see the note on RPCs below.
- When building `/battle`, put gold/XP/level writes in Postgres
  `security definer` RPCs rather than Server Actions. The profiles update
  policy (`supabase/schema.sql:103`) is row-scoped with no `with check`, so
  the anon key can already write `gold` directly from the browser. RPCs fix
  that *and* are a prerequisite for the static-export path.

## Not yet done / known gaps
- (Fixed) The Turbopack workspace-root warning is gone -- `turbopack.root` is
  pinned to the project in `next.config.ts`. The stray
  `C:\Users\Oliver\package-lock.json` that caused it is junk and still
  sitting there, but nothing reads it now.

## Test account
- Credentials for a throwaway test user live in `.env.local` as
  `TEST_USER_EMAIL` / `TEST_USER_PASSWORD`. Use them to log in and check UI
  work that sits behind auth (`/home`, `/tasks`, `/shop`, `/profile`).
- **Never move these into this file.** CLAUDE.md is committed and
  `github.com/ItsDraig/LevelUp` is a public repo. `.env*` is gitignored.

## DB workflow gotcha
- `supabase/schema.sql` is a single hand-maintained file, not a migrations
  folder — new schema changes get appended to the bottom as a guarded
  `-- Migration: ...` block (idempotent `add column if not exists` etc.).
- Claude only has the Supabase **anon key** in `.env.local`, not DB
  credentials — migrations must be run manually in the Supabase SQL editor.
- Gotcha hit last session: pasting a new migration into an SQL editor tab
  that still has the old query in it re-runs the `create table` statements
  too and fails with "relation already exists." Always start a **new, blank**
  query before pasting a migration block.
