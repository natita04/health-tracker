-- Morning notification setup. Run each part in Supabase > SQL Editor when the setup steps say so.

-- ============ Part 1: where devices are remembered ============
create table if not exists public.push_subscriptions (
  endpoint       text primary key,              -- the device's push address
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  p256dh         text not null,
  auth           text not null,
  tz             text not null default 'UTC',   -- the device's time zone
  notify_minutes int  not null default 300,     -- local time to send, minutes after midnight (300 = 05:00)
  last_sent_date date,                          -- so each device gets one morning message a day
  created_at     timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "own rows" on public.push_subscriptions;
create policy "own rows" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ============ Part 2: run the function every 5 minutes ============
-- Replace the two values in quotes first.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('https://YOUR-PROJECT.supabase.co', 'project_url');
select vault.create_secret('YOUR-PUBLISHABLE-OR-ANON-KEY', 'publishable_key');

select cron.schedule(
  'morning-push',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/morning-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
