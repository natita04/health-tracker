// reminders: sends a push notification for every item that has a reminder (and every chore)
// at its time, on its scheduled days, in each device's own time zone.
// Called every 5 minutes by a pg_cron job (see supabase/push.sql). Safe to call any time:
// push_sent remembers what went out, so a device gets each reminder at most once a day.
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

const LATE_WINDOW_MIN = 30 // cron runs every 5 min; if it was down longer, skip rather than nag late

interface Sub { endpoint: string; user_id: string; p256dh: string; auth: string; tz: string }
interface Task {
  id: string; user_id: string; category: string; title: string; details: string; days_mask: number
  time_minutes: number | null; start_date: string | null; end_date: string | null; notify: boolean
}

const EMOJI: Record<string, string> = {
  WEIGH: '⚖️', WALK: '🚶', WATER: '💧', WORKOUT: '🏋️', MEDS: '💊', BEAUTY: '💆', CHORE: '🧹',
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

function payload(t: Task, date: string) {
  const chore = t.category === 'CHORE'
  return {
    title: `${EMOJI[t.category] ?? '🔔'} ${t.title}`,
    body: t.details || (chore ? `Chore for ${hhmm(t.time_minutes!)}` : `Time for this, ${hhmm(t.time_minutes!)}`),
    url: '/',
    tag: `${t.id}-${date}`,
  }
}

async function send(sub: Sub, body: object) {
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(body), { TTL: 3600 })
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
  const json = (o: object, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const body = await req.json().catch(() => ({}))

  if (body.test) {
    // "Send a test" from the app: only the device that asked, right now.
    if (!body.endpoint) return json({ error: 'endpoint required' }, 400)
    const { data: sub } = await db.from('push_subscriptions').select('*').eq('endpoint', body.endpoint).maybeSingle()
    if (!sub) return json({ error: 'device not subscribed' }, 404)
    return json({ ok: true, result: await send(sub as Sub, { title: '🔔 Test reminder', body: 'Reminders are working on this device.', url: '/', tag: 'test' }) })
  }

  const { data: subs, error } = await db.from('push_subscriptions').select('*')
  if (error) return json({ error: error.message }, 500)
  if (!subs?.length) return json({ ok: true })

  const users = [...new Set((subs as Sub[]).map((s) => s.user_id))]
  const { data: tasks, error: tErr } = await db.from('tasks').select('*')
    .in('user_id', users).eq('archived', false).not('time_minutes', 'is', null)
    .or('notify.eq.true,category.eq.CHORE')
  if (tErr) return json({ error: tErr.message }, 500)

  const results: Record<string, number> = {}
  for (const sub of subs as Sub[]) {
    const now = localNow(sub.tz)
    const due = (tasks as Task[]).filter((t) =>
      t.user_id === sub.user_id &&
      (t.days_mask & (1 << now.weekday)) !== 0 &&
      (!t.start_date || now.date >= t.start_date) && (!t.end_date || now.date <= t.end_date) &&
      now.minutes >= t.time_minutes! && now.minutes < t.time_minutes! + LATE_WINDOW_MIN)
    if (!due.length) continue

    // Already checked off today? No need to remind.
    const { data: doneRows } = await db.from('completions').select('task_id')
      .eq('user_id', sub.user_id).eq('date', now.date).in('task_id', due.map((t) => t.id))
    const done = new Set((doneRows ?? []).map((r) => r.task_id))

    for (const t of due) {
      if (done.has(t.id)) continue
      // Claim it first: the primary key makes sure two overlapping runs can't both send it.
      const claim = await db.from('push_sent').insert({ endpoint: sub.endpoint, task_id: t.id, date: now.date })
      if (claim.error) continue // already sent (or claimed by another run)
      const r = await send(sub, payload(t, now.date))
      results[r] = (results[r] ?? 0) + 1
      if (r === 'expired') break
    }
  }

  // Housekeeping: the log only needs to cover today.
  const cutoff = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10)
  await db.from('push_sent').delete().lt('date', cutoff)

  return json({ ok: true, ...results })
})
