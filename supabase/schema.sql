-- Health Tracker database. Paste this whole file into Supabase > SQL Editor and click Run.
-- Safe to run more than once.
--
-- Every row belongs to a logged-in user, and row level security makes sure
-- you can only ever read or write your own rows.

create table if not exists public.tasks (
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  id           text not null,               -- stable key, history points at it
  category     text not null,               -- WEIGH | WALK | WORKOUT | MEDS | BEAUTY
  title        text not null,
  details      text not null default '',
  duration_min int,
  days_mask    int  not null default 127,   -- bit 0 = Monday ... bit 6 = Sunday
  time_minutes int,                         -- minutes after midnight, optional
  videos       jsonb,                       -- video options, e.g. [{"title": "...", "url": "https://..."}]
  steps        jsonb,                       -- optional exercise list, e.g. ["15 squats", ...]
  start_date   date,                        -- optional: only show from this day
  end_date     date,                        -- optional: only show until this day
  sort_order   int  not null default 0,
  archived     boolean not null default false,
  created_at   timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.completions (
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  date           date not null,
  task_id        text not null,
  title_snapshot text not null default '',  -- name at the time, so history reads right after renames
  completed_at   timestamptz not null default now(),
  primary key (user_id, date, task_id)
);

create table if not exists public.weights (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date    date not null,
  kg      numeric(5, 2) not null check (kg between 20 and 400),
  primary key (user_id, date)
);

create table if not exists public.user_settings (
  user_id          uuid primary key default auth.uid() references auth.users on delete cascade,
  defaults_version int not null default 0   -- which version of the built-in plan was added already
);

-- Added later; harmless if the columns already exist.
alter table public.tasks add column if not exists start_date date;
alter table public.tasks add column if not exists end_date   date;

-- Thank you thoughts: free-text entries per day.
create table if not exists public.thoughts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  date       date not null,
  text       text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists thoughts_user_date on public.thoughts (user_id, date);

-- Optional weight goal.
alter table public.user_settings add column if not exists goal_kg numeric(5, 2);

alter table public.thoughts      enable row level security;
alter table public.tasks         enable row level security;
alter table public.completions   enable row level security;
alter table public.weights       enable row level security;
alter table public.user_settings enable row level security;


-- Food log: what you ate each day, plus meals remembered for one-tap reuse.
create table if not exists public.food_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  date       date not null,
  name       text not null check (char_length(name) between 1 and 200),
  kcal       int  not null check (kcal between 0 and 10000),
  protein    numeric(5, 1) not null check (protein between 0 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists food_entries_user_date on public.food_entries (user_id, date);

create table if not exists public.saved_foods (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references auth.users on delete cascade,
  name      text not null check (char_length(name) between 1 and 200),
  kcal      int  not null check (kcal between 0 and 10000),
  protein   numeric(5, 1) not null check (protein between 0 and 1000),
  last_used timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.food_entries enable row level security;
alter table public.saved_foods  enable row level security;

-- Daily food goals (editable in the Food tab); empty means the defaults, 1800 kcal and 120 g.
alter table public.user_settings add column if not exists kcal_goal    int;
alter table public.user_settings add column if not exists protein_goal numeric(5, 1);

do $$
declare t text;
begin
  foreach t in array array['tasks', 'completions', 'weights', 'user_settings', 'thoughts', 'food_entries', 'saved_foods'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;
