import { supabase } from './supabase'

// Public half of the VAPID key pair (safe to publish). The private half lives only in
// the morning-push Edge Function's secrets.
const VAPID_PUBLIC_KEY = 'BDunnp3nd7QIFnDBL9zhE4E3mseox-9rzHsx-9_AF4lFx5yyvB7sz1gQqBRzBNsUyc3uQS0L32gZnD0TBmJGYMU'

export const FUNCTION_NAME = 'morning-push'

export type PushStatus = 'unsupported' | 'denied' | 'off' | 'on'

export interface PushState { status: PushStatus; minutes: number }

export const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

const toKey = (b64: string) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}

async function registration() {
  return navigator.serviceWorker.register('/sw.js')
}

export async function readPush(): Promise<PushState> {
  if (!pushSupported()) return { status: 'unsupported', minutes: 300 }
  if (Notification.permission === 'denied') return { status: 'denied', minutes: 300 }
  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return { status: 'off', minutes: 300 }
  const { data } = await supabase.from('push_subscriptions').select('notify_minutes').eq('endpoint', sub.endpoint).maybeSingle()
  return data ? { status: 'on', minutes: data.notify_minutes } : { status: 'off', minutes: 300 }
}

/** Ask for permission, subscribe this device and save it so the daily job can reach it. */
export async function enablePush(userId: string, minutes: number): Promise<PushStatus> {
  if (!pushSupported()) return 'unsupported'
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off'
  const reg = await registration()
  await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(VAPID_PUBLIC_KEY) }))
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  const { error } = await supabase.from('push_subscriptions').upsert({
    endpoint: json.endpoint, user_id: userId, p256dh: json.keys.p256dh, auth: json.keys.auth,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone, notify_minutes: minutes,
  })
  if (error) throw error
  return 'on'
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

export async function setPushTime(minutes: number) {
  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  const { error } = await supabase.from('push_subscriptions')
    .update({ notify_minutes: minutes, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, last_sent_date: null })
    .eq('endpoint', sub.endpoint)
  if (error) throw error
}

/** Ask the Edge Function to send today's summary to this device right now. */
export async function sendTestPush() {
  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) throw new Error('Notifications are off on this device')
  const { error } = await supabase.functions.invoke(FUNCTION_NAME, { body: { test: true, endpoint: sub.endpoint } })
  if (error) throw error
}
