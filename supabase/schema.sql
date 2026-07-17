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
