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

## Battle system (implemented, DB migration applied)
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
  both files are React-free precisely so this works. Rewrite `from '@/types'`
  to a relative path first; the alias does not resolve under bare `tsc`.
  `HealthBar.tsx` can be checked the same way (`--jsx react-jsx`, rendered with
  `react-dom/server`), but node needs `NODE_PATH` pointed at the project's
  `node_modules` since the scratchpad has none.

## Persistent HP + regeneration (implemented, DB migration applied)
- HP no longer resets between fights. `profiles.current_hp` stores it and
  `profiles.hp_updated_at` is an *anchor*: regeneration is derived from elapsed
  time on read (`regeneratedHp()` in `src/lib/battle.ts`), so there is no cron
  to run and someone away for a week is simply at full.
- Rate is `HP_REGEN_FRACTION_PER_HOUR` = 10% of max per hour, so empty to full
  is always 10 hours. Note the maxHp terms cancel in `minutesToFullHeal()` --
  a bigger pool heals faster in absolute HP, not in wall-clock time.
- **Never persist the output of `regeneratedHp()` without also writing a fresh
  `hp_updated_at`.** The anchor is what makes partial progress survive reads;
  writing the regenerated value while leaving the old anchor would double-count.
- `hp_max(level, wellness)` exists in SQL as well as in `derivePlayerStats()`,
  because `resolve_battle` has to clamp a client-reported HP and a clamp that
  trusted the client for its own bound would not be a clamp. Third mirrored
  formula in this codebase after the XP curve -- keep them in step.
- Fleeing calls the separate `sync_hp` RPC. Without it, taking damage and
  walking away would be a free full heal. `sync_hp` only ever writes HP
  *downward*, so it cannot be used to top up.
- A throttled 5s heartbeat in `BattleClient.tsx` syncs HP downward during a
  fight. It exists because the flee write is fire-and-forget: navigating in the
  same instant aborts it, which reopened the free-heal `sync_hp` was added to
  close. It also covers closing the tab mid-fight. Because HP only ever falls
  during combat the writes are monotonic, and `sync_hp` ignores any value that
  is not a decrease. `syncHpAction` deliberately does **not** call
  `revalidatePath` -- on a heartbeat that would bounce the router mid-combat.
- Defeat forces HP to 0 server-side regardless of what the client reports, so
  losing costs a full 10-hour rest.
- **That cost is deliberate, not an oversight to be tuned away.** The app is
  for making progress on goals; battling is a reward loop attached to that, not
  the point of the app. A hard cap of roughly a few fights a day is the
  intended shape, and the 10-hour rest is what enforces it. Anyone (including a
  future Claude) looking at a 10-hour lockout and reading it as "too harsh"
  should leave it alone unless Oliver says otherwise.
- Idea, not built: make **wellness raise the heal rate**, so the stat has a
  second-order use beyond max HP and resting rewards the wellness habit. Would
  mean `HP_REGEN_FRACTION_PER_HOUR` becoming a function of `stat_wellness`
  in `src/lib/battle.ts` -- and note it would have to stay purely a *display*
  concern or move into SQL too, since `regeneratedHp()` is what the server
  renders from.

## Stat scaling + task-completion overheal (code done, **MIGRATION NOT RUN**)
- Each category now buys exactly one combat lever, all of it centralised in a
  "Stat scaling" section at the top of `src/lib/battle.ts`:
  Body -> damage *and* how much a raised guard absorbs; Mind -> magic damage
  and max mana; Wellness -> max HP; Career -> gold earned everywhere.
- Body/Mind/Wellness were **already wired** before this pass and their numbers
  are unchanged -- what was missing was that nothing on screen said so. The
  pre-fight card in `BattleClient.tsx` now lists what each stat is buying.
  Career's gold bonus and Body's effect on Defend are the genuinely new maths.
- Career is `+2% gold per point, capped at +100%` and applies to task gold
  (`HomeClient.tsx`) and battle gold (inside `resolve_battle`). Deliberately
  held in **whole integer percent** on both sides: integer division agrees
  between PL/pgSQL and JS where `0.02` does not, and a payout disagreeing with
  the number the client just animated reads as a bug. Verified equal across
  ~20k base/career combinations.
- Body improves `defendMitigation()` from 0.40 down to a **floor of 0.15**.
  The floor is load-bearing for the same reason `HEAVY_MULTIPLIER` has to stay
  above 2.0, just from the other side: Defend already pays mana as well as
  mitigating, so an unbounded scale would make bracing strictly better than
  swinging. Re-simulated after the change (harness regenerated per the note
  below): attack-spam still never beats a real read, and pure turtling wins 0%
  everywhere. A very tanky player *can* out-last a Slime for ~11 minutes while
  only defending, but the `Math.max(1, ...)` damage floor means it always ends
  in a loss -- there is no stalemate.
- **Overheal**: clearing every task for the day heals a full max-HP *on top of*
  current HP, so 50% -> 150% and 1% -> 101%. There is no separate pool --
  overheal is simply HP above `hp_max`, which is why every existing damage path
  already spends it first and `sync_hp` already persists it draining. What it
  needed was for every clamp that bounded HP at `hp_max` to bound it at
  `hp_ceiling` (= 2x max) instead: the reducer's `start`, `sync_hp`, and
  `resolve_battle`. Miss one and the bonus is silently deleted.
- `regeneratedHp()` stops at `hp_max` and returns an already-overhealed value
  **untouched** rather than clamping down. The bonus is meant not to
  regenerate, and clamping there would delete it on the next page load, since
  that function is what every server render reads from.
- The heal is the **only upward HP write in the app**. All its authority is in
  the `grant_task_completion_heal` RPC, not the caller: it re-counts the
  completion rows itself rather than believing the client's "all done", bounds
  the date to +/- 1 day of the server's, and requires it to be strictly later
  than `profiles.last_heal_date` -- which caps it at one heal per calendar day.
  The date is a parameter at all because completion rows are keyed by the
  client's local day (`todayString()`), not the server's.
- Displayed as a second gold segment on `HealthBar.tsx` (battle picker, the
  fight screen, and the day-complete overlay). While overhealed the track
  represents the *total* rather than the max, because a bar already at 100%
  width has nowhere to draw a bonus. The visible consequence is intentional:
  the bar stays full and the gold segment shrinks, which reads as spending a
  buffer rather than losing health.
- There are now **five** mirrored JS/SQL formulas, not three: the XP curve,
  `hp_max`, `hp_ceiling`, `gold_bonus_percent`, and `hp_regenerated`. Change
  one side, change the other.
- Fixed in passing, both adjacent to the above: `HomeClient` derived every stat
  write from the `profile` prop, so it wrote the same `initial + 1` each time
  and a second same-category task in one sitting was a no-op -- which kept
  Career, and so its gold bonus, pinned near zero. It now accumulates in a ref.
  And `sync_hp` compared a reported HP against the raw stored column rather
  than the regenerated value, so someone stored at 30/100 who had rested to 80
  and fought down to 50 had the whole fight's damage discarded as "not a
  decrease". `backToCamp` had the mirror-image bug via `< state.stats.maxHp`.
- **Still to do:** the migration at the bottom of `supabase/schema.sql`
  (from `-- Migration: stat scaling + task-completion overheal`, line ~571)
  has **not** been run -- paste it into a **new, blank** Supabase SQL editor
  query. Until then the heal RPC and `last_heal_date` do not exist; both
  degrade quietly (no heal granted, no Career bonus on battle gold) rather
  than erroring. Nothing here has been exercised against a real database or
  eyeballed in a browser yet.

## PWA / installable app (hosted; install not yet re-tested)
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
- Install requires **HTTPS**, which the LAN URL (`http://10.0.0.100:3000`)
  cannot provide. **This is now unblocked** — the app is live on Vercel at
  `level-up-smoky-gamma.vercel.app`, so add-to-home-screen should finally work.
  Not yet tried on a real phone; that is the next step for the PWA goal.
  `next.config.ts` still has `allowedDevOrigins` set to the LAN IP for plain
  HTTP phone testing; that IP is DHCP-assigned and needs updating if it moves.
- Migrating to a bundled-offline native app (static export + Capacitor) is
  blocked by Server Actions, cookies, and proxy — all unsupported under
  `output: 'export'`. Deliberately deferred; see the note on RPCs below.
- When building `/battle`, put gold/XP/level writes in Postgres
  `security definer` RPCs rather than Server Actions. The profiles update
  policy (`supabase/schema.sql:103`) is row-scoped with no `with check`, so
  the anon key can already write `gold` directly from the browser. RPCs fix
  that *and* are a prerequisite for the static-export path.

## Hosting / deploy (live)
- Live at `level-up-smoky-gamma.vercel.app`. The Vercel project is git-connected
  to `ItsDraig/LevelUp`, so **pushes to `main` auto-deploy to Production**.
- Pushing needs the **ItsDraig** GitHub account. The machine's default `gh`
  login is a different account and gets a 403 on push --
  `gh auth switch -u ItsDraig` first. Commits succeed either way, so a failed
  push is easy to misread as done.
- `NEXT_PUBLIC_*` vars are **inlined at build time**. Adding or fixing them in
  the Vercel dashboard changes nothing until a rebuild ("Redeploy", with the
  build cache unchecked). The signature of missing env vars is distinctive:
  every route the proxy matches returns 500 while proxy-*excluded* paths
  (`manifest.webmanifest`, `*.png`) still serve 200 -- because `src/proxy.ts`
  constructs a Supabase client from those vars before anything else, and
  supabase-js throws `supabaseUrl is required.` on an empty value.
- Supabase -> Authentication -> URL Configuration needs the production origin as
  Site URL and `<origin>/auth/callback` in Redirect URLs, or auth works locally
  and breaks in prod (`src/app/auth/callback/route.ts` is what cares).
- Vercel **project** names must be lowercase; the repo being named `LevelUp` is
  irrelevant and does not need renaming. Set the project-name field at import.
- Connecting a repo does **not** itself trigger a build, and "Redeploy" on a
  deployment that originally came from a non-git source rebuilds *that old
  snapshot* rather than pulling from git. Check the deployment's commit hash.
- To check from the CLI whether Vercel actually reacted to a push:
  `gh api repos/ItsDraig/LevelUp/deployments`. A git-connected project
  registers a deployment per push; an empty array means it is not connected,
  whatever the dashboard's Git settings appear to say.

## Not yet done / known gaps
- The mid-fight HP heartbeat runs every 5s, so **up to 5 seconds of damage can
  still escape** if the tab is closed or navigated away at the wrong moment.
  Much better than losing a whole fight, but not exact.
- The stat-scaling / overheal migration has not been run, so none of that
  feature has touched a real database. See its section above.
- Combat balance is simulation-verified across builds and matchups (including
  after the Body/Defend change), and spot-checked in play against the
  **Slime only**. The Bandit and Golem are
  where attack-spam drops to 82% / 98% in simulation and neither has been
  played by hand.
- The mana economy has not been felt out over a long session; it is the part of
  the combat design most likely to want tuning.
- PWA add-to-home-screen has never been tried on a real device, even though
  HTTPS hosting now makes it possible.
- Enemy roster is 5 hand-authored SVG sprites in `EnemySprite.tsx`; the hero in
  `Hero.tsx` was redrawn to match that register. App icons are still the
  programmatic placeholders.
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
- Testing `/battle` can leave the account on 0 HP, which locks battling for 10
  hours by design. There is no in-app heal, and `sync_hp` only writes HP
  downward on purpose, so reset it in the SQL editor when testing:
  `update public.profiles set current_hp = public.hp_max(level, stat_wellness),
  hp_updated_at = now() where username = 'test';`

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
