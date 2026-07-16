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

## Not yet done / known gaps
- `task_modifier` shop item ("Double Gold Day") is purchasable but not wired
  to any actual gold-doubling logic — pre-existing gap, not addressed.
- `/battle` is still a stub. Weapons carry a `combat_power` field for this,
  but no combat loop exists yet.
- `src/middleware.ts` still uses the pre-Next-16 convention name; Next 16
  renamed this to `proxy.ts`. Works today but is a deprecation notice worth
  clearing if this file is touched again.

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
