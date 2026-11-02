import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { configured, supabase } from './supabase'
import { isOn, useStore, type Store } from './store'
import { useDemoStore } from './demo'
import { todayIso } from './dates'
import Login from './screens/Login'
import Today from './screens/Today'
import WeightScreen from './screens/Weight'
import History from './screens/History'
import Plan from './screens/Plan'
import Food from './screens/Food'
import Thanks from './screens/Thanks'
import Onboarding from './screens/Onboarding'
import { Icon, type IconName } from './icons'
import type { Area } from './types'

type Tab = 'today' | 'food' | 'weight' | 'thanks' | 'history' | 'plan'
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'today', label: 'Habits', icon: 'check-circle' },
  { id: 'food', label: 'Food', icon: 'apple' },
  { id: 'weight', label: 'Weight', icon: 'scale' },
  { id: 'thanks', label: 'Thank you', icon: 'heart' },
  { id: 'history', label: 'History', icon: 'chart' },
  { id: 'plan', label: 'Settings', icon: 'sliders' },
]
/** Tabs that belong to a part of the app you can turn off. */
const TAB_AREA: Partial<Record<Tab, Area>> = { food: 'FOOD', weight: 'WEIGHT', thanks: 'THANKS' }

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [guest, setGuest] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (guest) return <Guest onExit={() => setGuest(false)} />
  if (!configured) {
    return (
      <main className="page">
        <h1>Almost there</h1>
        <p>Supabase isn't connected yet. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (see README).</p>
      </main>
    )
  }
  if (!ready) return <main className="page center muted">Loading…</main>
  if (!session) return <Login onGuest={() => setGuest(true)} />
  return <Signed userId={session.user.id} />
}

function Signed({ userId }: { userId: string }) {
  return <Shell store={useStore(userId)} />
}

function Guest({ onExit }: { onExit: () => void }) {
  return <Shell store={useDemoStore(onExit)} />
}

function Shell({ store }: { store: Store }) {
  const [tab, setTab] = useState<Tab>('today')
  const [date, setDate] = useState(todayIso())
  const tabs = TABS.filter((t) => { const a = TAB_AREA[t.id]; return !a || isOn(store, a) })
  // A tab you just turned off falls back to Habits.
  const shown = tabs.some((t) => t.id === tab) ? tab : 'today'

  // Coming back to the tab on a new day should show that day.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') setDate(todayIso()) }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  return (
    <>
      <main className="page">
        {store.isGuest && (
          <div className="guest-bar row" role="status">
            <span className="grow">Guest preview · sample data, nothing is saved</span>
            <button className="text-btn" onClick={() => void store.signOut()}>Exit</button>
          </div>
        )}
        {store.error && (
          <div className="banner row" role="alert">
            <span className="grow">Something went wrong: {store.error}</span>
            <button onClick={store.clearError}>Dismiss</button>
          </div>
        )}
        {store.loading && store.tasks.length === 0 ? (
          <p className="center muted">Loading your plan…</p>
        ) : store.needsOnboarding ? (
          <Onboarding store={store} onDone={() => setTab('today')} />
        ) : (
          <>
            {shown === 'today' && <Today store={store} date={date} setDate={setDate} onSettings={() => setTab('plan')} />}
            {shown === 'food' && <Food store={store} date={date} setDate={setDate} />}
            {shown === 'weight' && <WeightScreen store={store} date={date} setDate={setDate} />}
            {shown === 'thanks' && <Thanks store={store} date={date} setDate={setDate} />}
            {shown === 'history' && <History store={store} openDay={(d) => { setDate(d); setTab('today') }} />}
            {shown === 'plan' && <Plan store={store} />}
          </>
        )}
      </main>
      {!store.needsOnboarding && <nav className="nav" aria-label="Main">
        {tabs.map((t) => (
          <button
            key={t.id}
            aria-label={t.label}
            aria-current={shown === t.id ? 'page' : undefined}
            onClick={() => {
              // Tapping the tab you're on jumps back to today; Food and Weight never show a future day.
              if (t.id === shown || date > todayIso()) setDate(todayIso())
              setTab(t.id)
            }}
          >
            <Icon name={t.icon} size={24} />
          </button>
        ))}
      </nav>}
    </>
  )
}
