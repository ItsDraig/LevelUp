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
- `/battle` is still a stub. Weapons carry a `combat_power` field for this,
  but no combat loop exists yet.
- Build warns that Turbopack inferred the workspace root from a stray
  `C:\Users\Oliver\package-lock.json`. Harmless so far; fix by setting
  `turbopack.root` in `next.config.ts` or deleting the stray lockfile.

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
