import { supabase } from './supabase'

// Public half of the VAPID key pair (safe to publish). The private half lives only in
// the reminders Edge Function's secrets.
const VAPID_PUBLIC_KEY = 'BDunnp3nd7QIFnDBL9zhE4E3mseox-9rzHsx-9_AF4lFx5yyvB7sz1gQqBRzBNsUyc3uQS0L32gZnD0TBmJGYMU'

export const FUNCTION_NAME = 'reminders'

export type PushStatus = 'unsupported' | 'denied' | 'off' | 'on'

export const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

const toKey = (b64: string) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}

async function currentSub() {
  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  return reg?.pushManager.getSubscription() ?? null
}

export async function readPush(): Promise<PushStatus> {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const sub = await currentSub()
  if (!sub) return 'off'
  const { data } = await supabase.from('push_subscriptions').select('endpoint').eq('endpoint', sub.endpoint).maybeSingle()
  return data ? 'on' : 'off'
}

/** Ask for permission, subscribe this device and save it so reminders can reach it. */
export async function enablePush(userId: string): Promise<PushStatus> {
  if (!pushSupported()) return 'unsupported'
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off'
  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(VAPID_PUBLIC_KEY) }))
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  const { error } = await supabase.from('push_subscriptions').upsert({
    endpoint: json.endpoint, user_id: userId, p256dh: json.keys.p256dh, auth: json.keys.auth,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })
  if (error) throw error
  return 'on'
}

export async function disablePush() {
  const sub = await currentSub()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

/** Keep the device's time zone fresh (travel, DST changes in a different zone). */
export async function syncTimeZone() {
  const sub = await currentSub()
  if (!sub) return
  await supabase.from('push_subscriptions')
    .update({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone })
    .eq('endpoint', sub.endpoint)
}

/** Ask the Edge Function to send a test reminder to this device right now. */
export async function sendTestPush() {
  const sub = await currentSub()
  if (!sub) throw new Error('Notifications are off on this device')
  const { error } = await supabase.functions.invoke(FUNCTION_NAME, { body: { test: true, endpoint: sub.endpoint } })
  if (error) throw error
}
