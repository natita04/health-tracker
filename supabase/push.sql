-- Reminder notifications setup. Run each part in Supabase > SQL Editor when the setup steps say so.
-- Safe to run more than once.

-- ============ Part 1: tables ============
-- Devices that get notifications.
create table if not exists public.push_subscriptions (
  endpoint   text primary key,              -- the device's push address
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  p256dh     text not null,
  auth       text not null,
  tz         text not null default 'UTC',   -- the device's time zone
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "own rows" on public.push_subscriptions;
create policy "own rows" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- The old once-a-day morning message is gone.
alter table public.push_subscriptions drop column if exists notify_minutes;
alter table public.push_subscriptions drop column if exists last_sent_date;

-- Which items get a reminder (chores always do). Also in schema.sql.
alter table public.tasks add column if not exists notify boolean not null default false;

-- What was already sent, so each reminder goes out once per device per day.
-- Only the Edge Function (service role) touches it: RLS on, no policies.
create table if not exists public.push_sent (
  endpoint text not null references public.push_subscriptions on delete cascade,
  task_id  text not null,
  date     date not null,
  primary key (endpoint, task_id, date)
);
alter table public.push_sent enable row level security;

-- ============ Part 2: run the function every 5 minutes ============
-- First time only: replace the two values in quotes and run these two lines.
-- (Skip them if you already set up the old morning notification, the secrets are still there.)
-- select vault.create_secret('https://YOUR-PROJECT.supabase.co', 'project_url');
-- select vault.create_secret('YOUR-PUBLISHABLE-OR-ANON-KEY', 'publishable_key');

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Retire the old morning job if it's there.
select cron.unschedule(jobid) from cron.job where jobname = 'morning-push';

select cron.schedule(
  'reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
