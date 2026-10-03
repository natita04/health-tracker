import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { configured, supabase } from './supabase'
import { useStore, type Store } from './store'
import { useDemoStore } from './demo'
import { todayIso } from './dates'
import Login from './screens/Login'
import Today from './screens/Today'
import WeightScreen from './screens/Weight'
import History from './screens/History'
import Plan from './screens/Plan'
import { Icon, type IconName } from './icons'

type Tab = 'today' | 'weight' | 'history' | 'plan'
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'today', label: 'Today', icon: 'check-circle' },
  { id: 'weight', label: 'Weight', icon: 'scale' },
  { id: 'history', label: 'History', icon: 'chart' },
  { id: 'plan', label: 'Plan', icon: 'sliders' },
]

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
        ) : (
          <>
            {tab === 'today' && <Today store={store} date={date} setDate={setDate} />}
            {tab === 'weight' && <WeightScreen store={store} />}
            {tab === 'history' && <History store={store} openDay={(d) => { setDate(d); setTab('today') }} />}
            {tab === 'plan' && <Plan store={store} />}
          </>
        )}
      </main>
      <nav className="nav" aria-label="Main">
        {TABS.map((t) => (
          <button
            key={t.id}
            aria-label={t.label}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => { if (t.id === 'today' && tab === 'today') setDate(todayIso()); setTab(t.id) }}
          >
            <Icon name={t.icon} size={24} />
          </button>
        ))}
      </nav>
    </>
  )
}
