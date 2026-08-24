-- ============================================================
-- Level Up! -- Supabase Schema
-- Run this in the Supabase SQL editor to set up the database.
-- ============================================================

-- Profiles (one per user, created on signup via trigger)
create table public.profiles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade not null unique,
  username        text not null,
  gold            integer not null default 0,
  streak          integer not null default 0,
  max_streak      integer not null default 0,  -- highest streak ever reached
  last_completed_date date default null,  -- date all tasks were completed
  level           integer not null default 1,
  stat_mind       integer not null default 0,
  stat_body       integer not null default 0,
  stat_wellness   integer not null default 0,
  stat_career     integer not null default 0,
  created_at      timestamptz not null default now()
);

-- Tasks (recurring habits + one-off tasks)
create table public.tasks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  name            text not null,
  category        text not null check (category in ('Mind','Body','Wellness','Career','Basic')),
  difficulty      text not null check (difficulty in ('Easy','Medium','Hard')),
  gold_value      integer not null default 10,
  is_recurring    boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Task completions (one row per task per day completed)
create table public.task_completions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  task_id         uuid references public.tasks(id) on delete cascade not null,
  completed_date  date not null default current_date,
  gold_awarded    integer not null default 0,
  created_at      timestamptz not null default now(),
  unique (task_id, completed_date)  -- prevent double-completing same task same day
);

-- Goals (multi-day big tasks)
create table public.goals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  name            text not null,
  category        text not null check (category in ('Mind','Body','Wellness','Career','Basic')),
  description     text not null default '',
  duration_days   integer not null default 7,
  gold_reward     integer not null default 200,
  days_contributed integer not null default 0,
  is_complete     boolean not null default false,
  created_at      timestamptz not null default now()
);

-- Goal contributions (one row per day the user checks in on a goal)
create table public.goal_contributions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  goal_id         uuid references public.goals(id) on delete cascade not null,
  contributed_date date not null default current_date,
  created_at      timestamptz not null default now(),
  unique (goal_id, contributed_date)
);

-- Shop items (seeded below)
create table public.shop_items (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text not null,
  type            text not null check (type in ('streak_shield','goal_slot','task_modifier','cosmetic')),
  cost            integer not null,
  effect_value    integer default null,
  icon            text not null default 'shield'
);

-- User inventory
create table public.inventory (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  shop_item_id    uuid references public.shop_items(id) on delete cascade not null,
  quantity        integer not null default 1,
  unique (user_id, shop_item_id)
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles         enable row level security;
alter table public.tasks            enable row level security;
alter table public.task_completions enable row level security;
alter table public.goals            enable row level security;
alter table public.goal_contributions enable row level security;
alter table public.inventory        enable row level security;

-- Profiles
create policy "Users can view own profile"   on public.profiles for select using (auth.uid() = user_id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = user_id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = user_id);

-- Tasks
create policy "Users can manage own tasks" on public.tasks for all using (auth.uid() = user_id);

-- Task completions
create policy "Users can manage own completions" on public.task_completions for all using (auth.uid() = user_id);

-- Goals
create policy "Users can manage own goals" on public.goals for all using (auth.uid() = user_id);

-- Goal contributions
create policy "Users can manage own contributions" on public.goal_contributions for all using (auth.uid() = user_id);

-- Shop items (public read)
alter table public.shop_items enable row level security;
create policy "Anyone can view shop items" on public.shop_items for select using (true);

-- Inventory
create policy "Users can manage own inventory" on public.inventory for all using (auth.uid() = user_id);

-- ============================================================
-- Trigger: auto-create profile on signup
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- Seed: shop items
-- ============================================================

insert into public.shop_items (name, description, type, cost, effect_value, icon) values
  ('Streak Shield',    'Protect your streak if you miss a day. One use.',              'streak_shield',   150, 1,    'shield'),
  ('Extra Goal Slot',  'Unlock an additional active goal slot. Permanent.',            'goal_slot',       300, 1,    'target'),
  ('Double Gold Day',  'Earn 2x gold from all tasks for one full day.',                'task_modifier',   200, 2,    'coins'),
  ('Iron Helm',        'Cosmetic helmet for your hero. Purely aesthetic.',             'cosmetic',        100, null, 'hard-hat'),
  ('Cape of Streaks',  'A flowing cape that grows with your streak. Cosmetic.',        'cosmetic',        250, null, 'wind');

-- ============================================================
-- Migration: add max_streak to already-provisioned databases
-- Safe to re-run; no-op once the column exists.
-- ============================================================

alter table public.profiles add column if not exists max_streak integer not null default 0;
update public.profiles set max_streak = streak where max_streak < streak;

-- ============================================================
-- Migration: shop expansion -- weapons, task pricing, equip slot
-- Safe to re-run; guards on existence before altering.
-- ============================================================

-- Allow the 'weapon' item type
alter table public.shop_items drop constraint if exists shop_items_type_check;
alter table public.shop_items add constraint shop_items_type_check
  check (type in ('streak_shield','goal_slot','task_modifier','cosmetic','weapon'));

-- Weapon-specific columns: which stat (and how much of it) is required to
-- equip, plus a combat_power number for future battle use.
alter table public.shop_items add column if not exists required_stat text
  check (required_stat in ('stat_mind','stat_body','stat_wellness','stat_career'));
alter table public.shop_items add column if not exists required_stat_value integer;
alter table public.shop_items add column if not exists combat_power integer;

-- Track lifetime paid task purchases (price climbs forever, never resets)
-- and which weapon (if any) is currently equipped.
alter table public.profiles add column if not exists paid_task_count integer not null default 0;
alter table public.profiles add column if not exists equipped_weapon_id uuid references public.shop_items(id) on delete set null;

-- Rename the existing Streak Shield to match the "streak freeze" concept:
-- automatically consumed to bridge a missed day instead of requiring manual use.
update public.shop_items
  set name = 'Streak Freeze',
      description = 'Automatically protects your streak if you miss a day. Consumed on use.'
  where type = 'streak_shield';

-- Seed weapons (idempotent -- only insert if the table has none yet)
insert into public.shop_items (name, description, type, cost, icon, required_stat, required_stat_value, combat_power)
select * from (values
  ('Wooden Sword',  'A basic training sword. Anyone can swing it.',      'weapon', 50,  'sword', 'stat_body'::text, 0,  8),
  ('Iron Sword',    'A reliable blade for a seasoned adventurer.',       'weapon', 200, 'sword', 'stat_body'::text, 5,  18),
  ('Greatsword',    'A massive two-handed blade. Requires real strength.', 'weapon', 500, 'sword', 'stat_body'::text, 10, 32),
  ('Arcane Staff',  'Channels focused willpower into raw force.',        'weapon', 350, 'wand',  'stat_mind'::text, 8,  24)
) as w(name, description, type, cost, icon, required_stat, required_stat_value, combat_power)
where not exists (select 1 from public.shop_items where type = 'weapon');

-- ============================================================
-- Migration: Double Gold Day activation
-- Safe to re-run; guards on existence before altering.
-- Tracks which date (if any) a user has an active gold-doubling
-- effect running, so task completions on that date can be doubled.
-- ============================================================

alter table public.profiles add column if not exists double_gold_date date default null;

-- ============================================================
-- Migration: battle system -- enemies, XP/leveling, battle log
-- Safe to re-run; guards on existence before altering.
--
-- The fight itself runs client-side (a real-time tick loop can't
-- round-trip per tick), so ONLY the outcome is persisted, and it goes
-- through resolve_battle() below rather than a direct table write:
-- the profiles update policy is row-scoped with no `with check`, so the
-- anon key can already set `gold` to anything straight from the browser.
-- The RPC reads rewards off public.enemies, so the client names an
-- enemy, never an amount.
-- ============================================================

-- Enemy roster. Stat block is read by the client to run the fight;
-- gold_reward/xp_reward are re-read server-side by resolve_battle().
create table if not exists public.enemies (
  key             text primary key,
  name            text not null,
  flavor          text not null default '',
  max_hp          integer not null,
  attack_damage   integer not null,
  tick_ms         integer not null default 2800,
  heavy_chance    numeric not null default 0.15,  -- chance/tick of a telegraphed heavy
  recover_chance  numeric not null default 0.0,   -- chance/tick of self-heal
  gold_reward     integer not null,
  xp_reward       integer not null,
  min_level       integer not null default 1,
  sort_order      integer not null default 0
);

alter table public.enemies enable row level security;
drop policy if exists "Anyone can view enemies" on public.enemies;
create policy "Anyone can view enemies" on public.enemies for select using (true);

insert into public.enemies
  (key, name, flavor, max_hp, attack_damage, tick_ms, heavy_chance, recover_chance, gold_reward, xp_reward, min_level, sort_order)
values
  ('slime',  'Green Slime',     'Barely hostile. Mostly damp.',              45,  5,  3200, 0.12, 0.00,  12,  25, 1, 1),
  ('goblin', 'Goblin Scout',    'Fast, cowardly, and armed with a rock.',    70,  7,  2800, 0.15, 0.00,  25,  45, 2, 2),
  ('wolf',   'Dire Wolf',       'Hits often. Does not telegraph politely.',  135, 12, 2200, 0.18, 0.00,  40,  80, 3, 3),
  ('bandit', 'Highway Bandit',  'Wants your gold. Will work for it.',        185, 16, 2600, 0.22, 0.05,  65, 140, 5, 4),
  ('golem',  'Stone Golem',     'Slow, enormous, and extremely patient.',    270, 22, 3600, 0.28, 0.08, 110, 240, 8, 5)
on conflict (key) do update set
  name           = excluded.name,
  flavor         = excluded.flavor,
  max_hp         = excluded.max_hp,
  attack_damage  = excluded.attack_damage,
  tick_ms        = excluded.tick_ms,
  heavy_chance   = excluded.heavy_chance,
  recover_chance = excluded.recover_chance,
  gold_reward    = excluded.gold_reward,
  xp_reward      = excluded.xp_reward,
  min_level      = excluded.min_level,
  sort_order     = excluded.sort_order;

-- XP toward the next level. `level` already existed but was never written
-- to by anything -- battle is the first thing that moves it.
alter table public.profiles add column if not exists xp integer not null default 0;

-- One row per resolved fight. Doubles as the rate-limit source.
create table if not exists public.battle_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  enemy_key     text references public.enemies(key) on delete cascade not null,
  victory       boolean not null,
  gold_awarded  integer not null default 0,
  xp_awarded    integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists battle_log_user_created_idx
  on public.battle_log (user_id, created_at desc);

alter table public.battle_log enable row level security;
drop policy if exists "Users can view own battle log" on public.battle_log;
create policy "Users can view own battle log" on public.battle_log for select using (auth.uid() = user_id);
-- No insert policy on purpose: rows are written by resolve_battle() only.

-- Resolve a finished battle and pay out.
--
-- security definer + a pinned search_path: without the pin, a caller who
-- can create objects on their own search_path could shadow the tables this
-- function references and have it operate on those instead.
--
-- The XP curve here is mirrored in src/lib/battle.ts (xpToNext). Change one,
-- change the other.
create or replace function public.resolve_battle(p_enemy_key text, p_victory boolean)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id       uuid := auth.uid();
  v_enemy         public.enemies%rowtype;
  v_profile       public.profiles%rowtype;
  v_gold          integer := 0;
  v_xp            integer := 0;
  v_new_level     integer;
  v_new_xp        integer;
  v_levels_gained integer := 0;
  v_need          integer;
  v_last          timestamptz;
begin
  if v_user_id is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;

  select * into v_enemy from public.enemies where key = p_enemy_key;
  if not found then
    raise exception 'Unknown enemy: %', p_enemy_key using errcode = '22023';
  end if;

  select * into v_profile from public.profiles where user_id = v_user_id for update;
  if not found then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;

  if v_profile.level < v_enemy.min_level then
    raise exception 'Requires level %.', v_enemy.min_level using errcode = '22023';
  end if;

  -- The shortest winnable fight is ~20s. Anything faster is a script calling
  -- the RPC directly, not someone playing.
  select max(created_at) into v_last from public.battle_log where user_id = v_user_id;
  if v_last is not null and v_last > now() - interval '10 seconds' then
    raise exception 'Too soon since your last battle.' using errcode = '55000';
  end if;

  v_new_level := v_profile.level;
  v_new_xp    := v_profile.xp;

  if p_victory then
    v_gold   := v_enemy.gold_reward;
    v_xp     := v_enemy.xp_reward;
    v_new_xp := v_new_xp + v_xp;

    -- Loop, so one big win can carry across several levels.
    loop
      v_need := 100 + (v_new_level - 1) * 60;
      exit when v_new_xp < v_need;
      v_new_xp        := v_new_xp - v_need;
      v_new_level     := v_new_level + 1;
      v_levels_gained := v_levels_gained + 1;
    end loop;

    update public.profiles
       set gold  = gold + v_gold,
           xp    = v_new_xp,
           level = v_new_level
     where user_id = v_user_id;
  end if;

  insert into public.battle_log (user_id, enemy_key, victory, gold_awarded, xp_awarded)
  values (v_user_id, p_enemy_key, p_victory, v_gold, v_xp);

  return json_build_object(
    'gold_awarded',  v_gold,
    'xp_awarded',    v_xp,
    'gold',          v_profile.gold + v_gold,
    'xp',            v_new_xp,
    'level',         v_new_level,
    'levels_gained', v_levels_gained
  );
end;
$$;

revoke all    on function public.resolve_battle(text, boolean) from public;
grant  execute on function public.resolve_battle(text, boolean) to authenticated;

-- ============================================================
-- Migration: persistent HP with hourly regeneration
-- Safe to re-run; guards on existence before altering.
--
-- HP no longer resets between fights. It is stored, and regenerates
-- HP_REGEN_FRACTION_PER_HOUR (10%) of max per hour. Rather than running a
-- cron to tick it up, `hp_updated_at` is an anchor: elapsed time since it is
-- converted to healing on read. Nothing needs to be scheduled, and a user
-- who is away for a week is simply at full.
-- ============================================================

alter table public.profiles add column if not exists current_hp integer;
alter table public.profiles add column if not exists hp_updated_at timestamptz not null default now();

-- Max HP as a function of level and wellness.
--
-- MIRRORED in derivePlayerStats() in src/lib/battle.ts. It lives here too
-- because resolve_battle has to clamp a client-supplied HP value, and a clamp
-- that trusted the client for its own bound would not be a clamp.
create or replace function public.hp_max(p_level integer, p_wellness integer)
returns integer
language sql
immutable
set search_path = public
as $$
  select 60 + (greatest(coalesce(p_level, 1), 1) - 1) * 12 + greatest(coalesce(p_wellness, 0), 0) * 4;
$$;

-- Existing profiles start at full rather than at zero.
update public.profiles
   set current_hp = public.hp_max(level, stat_wellness)
 where current_hp is null;

-- Write HP without logging a battle. Used when fleeing: without it, taking
-- damage and then walking away would be a free full heal.
create or replace function public.sync_hp(p_hp integer)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id  uuid := auth.uid();
  v_profile  public.profiles%rowtype;
  v_max_hp   integer;
  v_clamped  integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;

  select * into v_profile from public.profiles where user_id = v_user_id for update;
  if not found then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;

  v_max_hp  := public.hp_max(v_profile.level, v_profile.stat_wellness);
  v_clamped := greatest(0, least(coalesce(p_hp, v_max_hp), v_max_hp));

  -- Only ever writes downward. Regeneration is time-based and derived on
  -- read, so accepting an increase here would let a caller heal at will.
  if v_clamped >= coalesce(v_profile.current_hp, v_max_hp) then
    return json_build_object('current_hp', v_profile.current_hp, 'max_hp', v_max_hp, 'changed', false);
  end if;

  update public.profiles
     set current_hp = v_clamped,
         hp_updated_at = now()
   where user_id = v_user_id;

  return json_build_object('current_hp', v_clamped, 'max_hp', v_max_hp, 'changed', true);
end;
$$;

revoke all     on function public.sync_hp(integer) from public;
grant  execute on function public.sync_hp(integer) to authenticated;

-- resolve_battle gains an ending-HP argument, so a fight's damage persists.
-- The old two-argument version is dropped rather than left as an overload --
-- an overload would silently keep working while never writing HP.
drop function if exists public.resolve_battle(text, boolean);

create or replace function public.resolve_battle(
  p_enemy_key text,
  p_victory   boolean,
  p_ending_hp integer
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id       uuid := auth.uid();
  v_enemy         public.enemies%rowtype;
  v_profile       public.profiles%rowtype;
  v_gold          integer := 0;
  v_xp            integer := 0;
  v_new_level     integer;
  v_new_xp        integer;
  v_levels_gained integer := 0;
  v_need          integer;
  v_last          timestamptz;
  v_max_hp        integer;
  v_ending_hp     integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;

  select * into v_enemy from public.enemies where key = p_enemy_key;
  if not found then
    raise exception 'Unknown enemy: %', p_enemy_key using errcode = '22023';
  end if;

  select * into v_profile from public.profiles where user_id = v_user_id for update;
  if not found then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;

  if v_profile.level < v_enemy.min_level then
    raise exception 'Requires level %.', v_enemy.min_level using errcode = '22023';
  end if;

  -- The shortest winnable fight is ~20s. Anything faster is a script calling
  -- the RPC directly, not someone playing.
  select max(created_at) into v_last from public.battle_log where user_id = v_user_id;
  if v_last is not null and v_last > now() - interval '10 seconds' then
    raise exception 'Too soon since your last battle.' using errcode = '55000';
  end if;

  -- Clamp the client's reported HP against a bound computed here. A defeat is
  -- always zero regardless of what the client claims.
  v_max_hp := public.hp_max(v_profile.level, v_profile.stat_wellness);
  if p_victory then
    v_ending_hp := greatest(0, least(coalesce(p_ending_hp, 0), v_max_hp));
  else
    v_ending_hp := 0;
  end if;

  v_new_level := v_profile.level;
  v_new_xp    := v_profile.xp;

  if p_victory then
    v_gold   := v_enemy.gold_reward;
    v_xp     := v_enemy.xp_reward;
    v_new_xp := v_new_xp + v_xp;

    -- Loop, so one big win can carry across several levels.
    loop
      v_need := 100 + (v_new_level - 1) * 60;
      exit when v_new_xp < v_need;
      v_new_xp        := v_new_xp - v_need;
      v_new_level     := v_new_level + 1;
      v_levels_gained := v_levels_gained + 1;
    end loop;
  end if;

  -- One update for both outcomes: gold/xp/level are unchanged on a loss
  -- (the locals still hold their current values), but HP must persist either way.
  update public.profiles
     set gold          = gold + v_gold,
         xp            = v_new_xp,
         level         = v_new_level,
         current_hp    = v_ending_hp,
         hp_updated_at = now()
   where user_id = v_user_id;

  insert into public.battle_log (user_id, enemy_key, victory, gold_awarded, xp_awarded)
  values (v_user_id, p_enemy_key, p_victory, v_gold, v_xp);

  return json_build_object(
    'gold_awarded',  v_gold,
    'xp_awarded',    v_xp,
    'gold',          v_profile.gold + v_gold,
    'xp',            v_new_xp,
    'level',         v_new_level,
    'levels_gained', v_levels_gained,
    'current_hp',    v_ending_hp,
    -- Recomputed for the new level: a level-up raises the ceiling.
    'max_hp',        public.hp_max(v_new_level, v_profile.stat_wellness)
  );
end;
$$;

revoke all     on function public.resolve_battle(text, boolean, integer) from public;
grant  execute on function public.resolve_battle(text, boolean, integer) to authenticated;

-- ============================================================
-- Migration: stat scaling + task-completion overheal
-- Safe to re-run; guards on existence before altering.
--
-- Two things land together because they share a clamp.
--
-- 1. Clearing every task for the day heals a full max-HP on top of current
--    HP rather than capped at it, so 50% -> 150% and 1% -> 101%. The excess
--    is a temporary buffer: damage spends it first and regeneration never
--    puts it back. It needs no separate column -- overheal is simply HP
--    above hp_max, so every existing damage path already spends it in the
--    right order. What it does need is for every clamp that used to bound
--    HP at hp_max to bound it at hp_ceiling instead.
--
-- 2. Career now multiplies gold earned. Battle payouts are computed in
--    resolve_battle rather than by the client, so the multiplier has to
--    exist here as well as in src/lib/battle.ts.
-- ============================================================

-- At most one task-completion heal per day. Compared against, never trusted:
-- see the strictly-increasing guard in grant_task_completion_heal.
alter table public.profiles add column if not exists last_heal_date date;

-- The absolute HP ceiling, overheal included.
--
-- MIRRORED as hpCeiling() in src/lib/battle.ts. Since the day's heal adds a
-- full max-HP, full -> 200% is the most that can ever be reached.
create or replace function public.hp_ceiling(p_level integer, p_wellness integer)
returns integer
language sql
immutable
set search_path = public
as $$
  select public.hp_max(p_level, p_wellness) * 2;
$$;

-- Career's gold bonus, in whole percent.
--
-- MIRRORED as careerGoldBonusPercent() in src/lib/battle.ts. Whole percent
-- and integer division on both sides deliberately: integer division agrees
-- between PL/pgSQL and JS, 0.02 does not, and a payout that disagreed with
-- the number the client just animated would look like a bug to the player.
create or replace function public.gold_bonus_percent(p_career integer)
returns integer
language sql
immutable
set search_path = public
as $$
  select least(100, greatest(coalesce(p_career, 0), 0) * 2);
$$;

-- Stored HP plus whatever has regenerated since the anchor.
--
-- MIRRORED as regeneratedHp() in src/lib/battle.ts. It has to exist here
-- because both the heal and the flee-sync compare a client-reported figure
-- against the player's *actual* current HP, and the stored column is only a
-- baseline -- the regenerated value is what the client is looking at.
--
-- Stops at hp_max, and returns an already-overhealed value untouched rather
-- than clamping it down: clamping here would delete the day's bonus on the
-- first read after it was granted.
create or replace function public.hp_regenerated(
  p_stored  integer,
  p_max_hp  integer,
  p_anchor  timestamptz
)
returns integer
language sql
stable
set search_path = public
as $$
  select case
    when p_stored is null then p_max_hp
    -- At or above full there is nothing to accrue, and this is also the guard
    -- that keeps regeneration from touching overheal at all.
    when least(greatest(p_stored, 0), p_max_hp * 2) >= p_max_hp
      then least(greatest(p_stored, 0), p_max_hp * 2)
    when p_anchor is null then greatest(p_stored, 0)
    else least(
      p_max_hp,
      greatest(p_stored, 0)
        + floor(
            greatest(extract(epoch from (now() - p_anchor)), 0) / 3600.0
            * 0.1 * p_max_hp
          )::integer
    )
  end;
$$;

-- ------------------------------------------------------------
-- sync_hp: clamp at the ceiling, and compare against regenerated HP
-- ------------------------------------------------------------
--
-- Two changes. The clamp moves from hp_max to hp_ceiling, or draining an
-- overheal mid-fight would be silently discarded as "not a decrease".
--
-- And the downward-only test now compares against hp_regenerated rather than
-- the raw stored column. The stored value is a stale baseline: someone stored
-- at 30/100 who has rested up to 80 and then fights down to 50 was reporting
-- a genuine decrease that the old test rejected as an increase, losing the
-- whole fight's damage and leaving the old anchor to keep accruing.
create or replace function public.sync_hp(p_hp integer)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id   uuid := auth.uid();
  v_profile   public.profiles%rowtype;
  v_max_hp    integer;
  v_ceiling   integer;
  v_effective integer;
  v_clamped   integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;

  select * into v_profile from public.profiles where user_id = v_user_id for update;
  if not found then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;

  v_max_hp    := public.hp_max(v_profile.level, v_profile.stat_wellness);
  v_ceiling   := public.hp_ceiling(v_profile.level, v_profile.stat_wellness);
  v_clamped   := greatest(0, least(coalesce(p_hp, v_ceiling), v_ceiling));
  v_effective := public.hp_regenerated(v_profile.current_hp, v_max_hp, v_profile.hp_updated_at);

  -- Only ever writes downward. Regeneration is time-based and derived on read,
  -- so accepting an increase here would let a caller heal at will.
  if v_clamped >= v_effective then
    return json_build_object(
      'current_hp', v_effective,
      'max_hp',     v_max_hp,
      'ceiling',    v_ceiling,
      'changed',    false
    );
  end if;

  update public.profiles
     set current_hp = v_clamped,
         hp_updated_at = now()
   where user_id = v_user_id;

  return json_build_object(
    'current_hp', v_clamped,
    'max_hp',     v_max_hp,
    'ceiling',    v_ceiling,
    'changed',    true
  );
end;
$$;

revoke all     on function public.sync_hp(integer) from public;
grant  execute on function public.sync_hp(integer) to authenticated;

-- ------------------------------------------------------------
-- grant_task_completion_heal: the only thing in the app that writes HP up
-- ------------------------------------------------------------
--
-- Every other HP write is downward-only, which is what makes time-based
-- regeneration safe. This one is the exception, so all of its authority has
-- to be here rather than in the caller:
--
--   * it re-checks that every task actually has a completion row for the day
--     instead of believing the client's "all done" claim;
--   * it refuses a date more than a day either side of the server's, so a
--     caller cannot replay a stack of historical dates; and
--   * it requires the date to be strictly later than the last heal, which
--     caps the whole thing at one heal per calendar day even with the
--     tolerance above.
--
-- The date is a parameter at all because completion rows are keyed by the
-- client's local date (see todayString()), and using current_date here would
-- fail to fire for anyone far enough from UTC.
create or replace function public.grant_task_completion_heal(p_date date)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id  uuid := auth.uid();
  v_profile  public.profiles%rowtype;
  v_max_hp   integer;
  v_ceiling  integer;
  v_current  integer;
  v_new_hp   integer;
  v_total    integer;
  v_done     integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;

  if p_date is null or p_date < current_date - 1 or p_date > current_date + 1 then
    raise exception 'Date out of range.' using errcode = '22023';
  end if;

  select * into v_profile from public.profiles where user_id = v_user_id for update;
  if not found then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;

  v_max_hp  := public.hp_max(v_profile.level, v_profile.stat_wellness);
  v_ceiling := public.hp_ceiling(v_profile.level, v_profile.stat_wellness);
  v_current := public.hp_regenerated(v_profile.current_hp, v_max_hp, v_profile.hp_updated_at);

  -- Strictly increasing, so the +/- 1 day tolerance above cannot be walked
  -- backwards for a second helping.
  if v_profile.last_heal_date is not null and p_date <= v_profile.last_heal_date then
    return json_build_object(
      'healed', false, 'reason', 'already_healed',
      'current_hp', v_current, 'max_hp', v_max_hp, 'overheal', greatest(0, v_current - v_max_hp)
    );
  end if;

  select count(*) into v_total from public.tasks where user_id = v_user_id;

  select count(*) into v_done
    from public.tasks t
   where t.user_id = v_user_id
     and exists (
       select 1 from public.task_completions c
        where c.user_id = v_user_id
          and c.task_id = t.id
          and c.completed_date = p_date
     );

  -- No tasks is not a cleared day, it is an empty one.
  if v_total = 0 or v_done < v_total then
    return json_build_object(
      'healed', false, 'reason', 'tasks_incomplete',
      'current_hp', v_current, 'max_hp', v_max_hp, 'overheal', greatest(0, v_current - v_max_hp)
    );
  end if;

  -- A full max-HP on top of current, not up to current. Capped at the ceiling,
  -- which only bites for someone who was already at full.
  v_new_hp := least(v_ceiling, v_current + v_max_hp);

  -- The fresh anchor is mandatory, not incidental: writing a regenerated value
  -- while leaving the old anchor in place would let the same elapsed time be
  -- counted twice on the next read.
  update public.profiles
     set current_hp     = v_new_hp,
         hp_updated_at  = now(),
         last_heal_date = p_date
   where user_id = v_user_id;

  return json_build_object(
    'healed',     true,
    'reason',     'granted',
    'healed_for', v_new_hp - v_current,
    'current_hp', v_new_hp,
    'max_hp',     v_max_hp,
    'overheal',   greatest(0, v_new_hp - v_max_hp)
  );
end;
$$;

revoke all     on function public.grant_task_completion_heal(date) from public;
grant  execute on function public.grant_task_completion_heal(date) to authenticated;

-- ------------------------------------------------------------
-- resolve_battle: pay Career's gold bonus, and preserve overheal on a win
-- ------------------------------------------------------------
create or replace function public.resolve_battle(
  p_enemy_key text,
  p_victory   boolean,
  p_ending_hp integer
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id       uuid := auth.uid();
  v_enemy         public.enemies%rowtype;
  v_profile       public.profiles%rowtype;
  v_gold          integer := 0;
  v_base_gold     integer := 0;
  v_gold_bonus    integer := 0;
  v_xp            integer := 0;
  v_new_level     integer;
  v_new_xp        integer;
  v_levels_gained integer := 0;
  v_need          integer;
  v_last          timestamptz;
  v_max_hp        integer;
  v_ceiling       integer;
  v_ending_hp     integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;

  select * into v_enemy from public.enemies where key = p_enemy_key;
  if not found then
    raise exception 'Unknown enemy: %', p_enemy_key using errcode = '22023';
  end if;

  select * into v_profile from public.profiles where user_id = v_user_id for update;
  if not found then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;

  if v_profile.level < v_enemy.min_level then
    raise exception 'Requires level %.', v_enemy.min_level using errcode = '22023';
  end if;

  -- The shortest winnable fight is ~20s. Anything faster is a script calling
  -- the RPC directly, not someone playing.
  select max(created_at) into v_last from public.battle_log where user_id = v_user_id;
  if v_last is not null and v_last > now() - interval '10 seconds' then
    raise exception 'Too soon since your last battle.' using errcode = '55000';
  end if;

  -- Clamp the client's reported HP against a bound computed here. A defeat is
  -- always zero regardless of what the client claims.
  --
  -- The bound is hp_ceiling, not hp_max: winning a fight while still carrying
  -- the day's overheal must not quietly strip it.
  v_max_hp  := public.hp_max(v_profile.level, v_profile.stat_wellness);
  v_ceiling := public.hp_ceiling(v_profile.level, v_profile.stat_wellness);
  if p_victory then
    v_ending_hp := greatest(0, least(coalesce(p_ending_hp, 0), v_ceiling));
  else
    v_ending_hp := 0;
  end if;

  v_new_level := v_profile.level;
  v_new_xp    := v_profile.xp;

  if p_victory then
    -- Career's cut. Read off the profile, never off the request: the enemy's
    -- reward and the multiplier both come from the server, so the only thing
    -- the client got to choose was which enemy it claims to have fought.
    v_base_gold  := v_enemy.gold_reward;
    v_gold_bonus := (v_base_gold * public.gold_bonus_percent(v_profile.stat_career)) / 100;
    v_gold       := v_base_gold + v_gold_bonus;
    v_xp         := v_enemy.xp_reward;
    v_new_xp     := v_new_xp + v_xp;

    -- Loop, so one big win can carry across several levels.
    loop
      v_need := 100 + (v_new_level - 1) * 60;
      exit when v_new_xp < v_need;
      v_new_xp        := v_new_xp - v_need;
      v_new_level     := v_new_level + 1;
      v_levels_gained := v_levels_gained + 1;
    end loop;
  end if;

  -- One update for both outcomes: gold/xp/level are unchanged on a loss
  -- (the locals still hold their current values), but HP must persist either way.
  update public.profiles
     set gold          = gold + v_gold,
         xp            = v_new_xp,
         level         = v_new_level,
         current_hp    = v_ending_hp,
         hp_updated_at = now()
   where user_id = v_user_id;

  insert into public.battle_log (user_id, enemy_key, victory, gold_awarded, xp_awarded)
  values (v_user_id, p_enemy_key, p_victory, v_gold, v_xp);

  return json_build_object(
    'gold_awarded',  v_gold,
    'gold_bonus',    v_gold_bonus,
    'xp_awarded',    v_xp,
    'gold',          v_profile.gold + v_gold,
    'xp',            v_new_xp,
    'level',         v_new_level,
    'levels_gained', v_levels_gained,
    'current_hp',    v_ending_hp,
    -- Recomputed for the new level: a level-up raises the ceiling.
    'max_hp',        public.hp_max(v_new_level, v_profile.stat_wellness),
    'hp_ceiling',    public.hp_ceiling(v_new_level, v_profile.stat_wellness)
  );
end;
$$;

revoke all     on function public.resolve_battle(text, boolean, integer) from public;
grant  execute on function public.resolve_battle(text, boolean, integer) to authenticated;

revoke all     on function public.hp_ceiling(integer, integer) from public;
grant  execute on function public.hp_ceiling(integer, integer) to authenticated;
revoke all     on function public.hp_regenerated(integer, integer, timestamptz) from public;
grant  execute on function public.hp_regenerated(integer, integer, timestamptz) to authenticated;
revoke all     on function public.gold_bonus_percent(integer) from public;
grant  execute on function public.gold_bonus_percent(integer) to authenticated;
