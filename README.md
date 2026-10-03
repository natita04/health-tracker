# Health Tracker

A mobile-friendly website for your daily health plan: check-offs, a basic daily workout,
Heather Robertson workouts 4x a week, meds schedule, beauty routine, weight log with a trend
chart, and history/streaks. Data lives in Supabase, the site is hosted on Vercel.

## One-time setup (~15 min)

### 1. Supabase (the database)
1. Sign up at https://supabase.com and create a **New project** (any name, pick a region near you, save the DB password somewhere).
2. Open **SQL Editor**, paste all of [`supabase/schema.sql`](supabase/schema.sql), click **Run**.
3. Go to **Project Settings → API keys / Data API** and copy:
   - the **Project URL** (`https://xxxx.supabase.co`)
   - the **anon / publishable** key (NOT the `service_role` / secret key)
4. Optional but easier: **Authentication → Sign In / Providers → Email** and turn off **Confirm email**.

### 2. Vercel (the website)
1. Sign in at https://vercel.com with GitHub, click **Add New → Project**, import `health-tracker`.
2. Framework is detected as **Vite**. Under **Environment Variables** add:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon/publishable key
3. Click **Deploy**. Every push to the production branch redeploys automatically.

### 3. On your phone
1. Open the Vercel URL, tap **First time? Create account**, then sign in.
2. Lock the door behind you: in Supabase, **Authentication → Sign In / Providers**, turn off **Allow new users to sign up**.
3. In Chrome: **⋮ → Add to Home screen**, so it opens like an app.

## How your data stays safe when things change
- Everything is saved in Supabase, so updating the website never touches your data.
- Each plan item has a stable ID, and check-offs point at it: renaming or rescheduling keeps history,
  and "Remove" only archives the item.
- The built-in plan (`src/defaults.ts`) is versioned. New default items get added to your account
  without overwriting your edits.
- Row level security: you can only ever read or write your own rows.
- **Plan → Download backup** saves everything as a JSON file.

## Changing the plan
Most changes don't need code: use the **Plan** tab to add, edit or remove items
(including the exercise list of the daily workout).

## Local development
```bash
cp .env.example .env.local   # fill in your Supabase values
npm install
npm run dev
```

## Morning notification (web push)
- `public/sw.js` shows the notification; `src/push.ts` subscribes the device (Plan tab).
- `supabase/functions/morning-push/index.ts` builds each device's plan for the day and sends it.
  Secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (the public one is also in `src/push.ts`).
  JWT verification is off for this function; it only ever sends a device its own once-a-day summary.
- `supabase/push.sql`: the `push_subscriptions` table (part 1) and the every-5-minutes cron job (part 2).
