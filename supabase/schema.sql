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
  link         text,
  steps        jsonb,                       -- optional exercise list, e.g. ["15 squats", ...]
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

alter table public.tasks         enable row level security;
alter table public.completions   enable row level security;
alter table public.weights       enable row level security;
alter table public.user_settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['tasks', 'completions', 'weights', 'user_settings'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;
