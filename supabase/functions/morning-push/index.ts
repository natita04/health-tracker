// morning-push: sends each subscribed device its plan for the day, once a day at its chosen time.
// Called every 5 minutes by a pg_cron job (see supabase/push.sql). Safe to call any time:
// a device only gets one morning message per local day.
//
// Secrets it needs (Supabase > Edge Functions > Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
webpush.setVapidDetails(
  'https://github.com/natita04/health-tracker',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

const LATE_WINDOW_MIN = 120 // don't send a "morning" message hours late

interface Sub { endpoint: string; user_id: string; p256dh: string; auth: string; tz: string; notify_minutes: number; last_sent_date: string | null }
interface Task {
  id: string; category: string; title: string; days_mask: number; time_minutes: number | null
  start_date: string | null; end_date: string | null; archived: boolean; duration_min: number | null
}

/** Local date (YYYY-MM-DD), minutes after midnight and weekday (Mon=0) in a time zone. */
function localNow(tz: string) {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
    }).formatToParts(new Date())
  } catch {
    return localNow('UTC')
  }
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]))
  const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday)
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute), weekday: wd }
}

const pad = (n: number) => String(n).padStart(2, '0')
const hhmm = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`

// Same list and rotation as the app (src/quotes.ts).
const QUOTES: [string, string][] = [
  ['We are what we repeatedly do. Excellence, then, is not an act, but a habit.', 'Will Durant'],
  ['You do not rise to the level of your goals. You fall to the level of your systems.', 'James Clear'],
  ['Habits are the compound interest of self-improvement.', 'James Clear'],
  ['What you do every day matters more than what you do once in a while.', 'Gretchen Rubin'],
  ['Success is the sum of small efforts, repeated day in and day out.', 'Robert Collier'],
  ['A journey of a thousand miles begins with a single step.', 'Lao Tzu'],
  ['Fall seven times, stand up eight.', 'Japanese proverb'],
  ['The best time to plant a tree was 20 years ago. The second best time is now.', 'Proverb'],
  ['Hard choices, easy life. Easy choices, hard life.', 'Jerzy Gregorek'],
  ['Well done is better than well said.', 'Benjamin Franklin'],
  ["You miss 100% of the shots you don't take.", 'Wayne Gretzky'],
  ['I am not a product of my circumstances. I am a product of my decisions.', 'Stephen Covey'],
  ['Do what you can, with what you have, where you are.', 'Theodore Roosevelt'],
  ["Take care of your body. It's the only place you have to live.", 'Jim Rohn'],
  ['Our bodies are our gardens, to the which our wills are gardeners.', 'William Shakespeare, Othello'],
  ['Caring for myself is not self-indulgence, it is self-preservation.', 'Audre Lorde'],
  ['Almost everything will work again if you unplug it for a few minutes, including you.', 'Anne Lamott'],
  ['Motivation is what gets you started. Habit is what keeps you going.', 'Jim Ryun'],
  ['The groundwork for all happiness is good health.', 'Leigh Hunt'],
  ["Don't count the days, make the days count.", 'Muhammad Ali'],
  ['The man who moves a mountain begins by carrying away small stones.', 'Proverb'],
  ['Consistency beats intensity.', 'Unknown'],
  ['Small steps every day add up to big results.', 'Unknown'],
  ["You don't have to be extreme, just consistent.", 'Unknown'],
  ['Be stronger than your excuses.', 'Unknown'],
  ['Progress, not perfection.', 'Unknown'],
  ["The only bad workout is the one that didn't happen.", 'Unknown'],
  ['Every day is a fresh start.', 'Unknown'],
]

function quoteFor(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  const day = Date.UTC(y, m - 1, d) / 86_400_000
  const [text, author] = QUOTES[((day % QUOTES.length) + QUOTES.length) % QUOTES.length]
  return `"${text}" - ${author}`
}

async function summary(userId: string, date: string, weekday: number) {
  const { data, error } = await db.from('tasks').select('*').eq('user_id', userId).eq('archived', false)
  if (error) throw error
  const today = (data as Task[]).filter((t) =>
    (t.days_mask & (1 << weekday)) !== 0 && (!t.start_date || date >= t.start_date) && (!t.end_date || date <= t.end_date))
  const of = (c: string) => today.filter((t) => t.category === c).sort((a, b) => (a.time_minutes ?? -1) - (b.time_minutes ?? -1))
  const lines: string[] = []
  const workouts = of('WORKOUT')
  if (workouts.length) lines.push(`Workout: ${workouts.map((t) => t.title).join(' + ')}`)
  of('WALK').forEach((t) => lines.push(t.title))
  if (of('WATER').length) lines.push(of('WATER')[0].title)
  const meds = of('MEDS')
  if (meds.length) lines.push(`Meds: ${meds.map((t) => (t.time_minutes != null ? `${hhmm(t.time_minutes)} ` : '') + t.title).join(' · ')}`)
  const beauty = of('BEAUTY')
  if (beauty.length) lines.push(`Beauty: ${beauty.map((t) => t.title).join(', ')}`)
  lines.push('Weigh in before breakfast, and 3 thank you thoughts')
  lines.push(quoteFor(date))
  return {
    title: `Good morning! ${today.length} things on today's plan`,
    body: lines.join('\n'),
    url: '/',
    tag: `morning-${date}`,
  }
}

async function send(sub: Sub, payload: object) {
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 3 * 3600 })
    return 'sent'
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode
    if (code === 404 || code === 410) {
      // The browser dropped this subscription (app uninstalled, permission revoked): forget it.
      await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      return 'expired'
    }
    console.error('push failed', code, (e as Error).message)
    return 'failed'
  }
}

Deno.serve(async (req) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const body = await req.json().catch(() => ({}))

  let query = db.from('push_subscriptions').select('*')
  if (body.test) {
    // "Send a test" from the app: only the device that asked, right now.
    if (!body.endpoint) return new Response(JSON.stringify({ error: 'endpoint required' }), { status: 400, headers: cors })
    query = query.eq('endpoint', body.endpoint)
  }
  const { data: subs, error } = await query
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors })

  const results: Record<string, number> = {}
  for (const sub of (subs ?? []) as Sub[]) {
    const now = localNow(sub.tz)
    if (!body.test) {
      const due = now.minutes >= sub.notify_minutes && now.minutes < sub.notify_minutes + LATE_WINDOW_MIN
      if (!due || sub.last_sent_date === now.date) continue
    }
    const r = await send(sub, await summary(sub.user_id, now.date, now.weekday))
    results[r] = (results[r] ?? 0) + 1
    if (r === 'sent' && !body.test) {
      await db.from('push_subscriptions').update({ last_sent_date: now.date }).eq('endpoint', sub.endpoint)
    }
  }
  return new Response(JSON.stringify({ ok: true, ...results }), { headers: { ...cors, 'Content-Type': 'application/json' } })
})
