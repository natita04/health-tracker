import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { configured, supabase } from './supabase'
import { useStore } from './store'
import { todayIso } from './dates'
import Login from './screens/Login'
import Today from './screens/Today'
import WeightScreen from './screens/Weight'
import History from './screens/History'
import Plan from './screens/Plan'

type Tab = 'today' | 'weight' | 'history' | 'plan'
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: '✅' },
  { id: 'weight', label: 'Weight', icon: '⚖️' },
  { id: 'history', label: 'History', icon: '📈' },
  { id: 'plan', label: 'Plan', icon: '🛠️' },
]

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!configured) {
    return (
      <main className="page">
        <h1>Almost there</h1>
        <p>Supabase isn't connected yet. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (see README).</p>
      </main>
    )
  }
  if (!ready) return <main className="page center muted">Loading…</main>
  if (!session) return <Login />
  return <Signed userId={session.user.id} />
}

function Signed({ userId }: { userId: string }) {
  const store = useStore(userId)
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
        {store.error && (
          <div className="banner error" onClick={store.clearError}>
            Something went wrong: {store.error} <u>dismiss</u>
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
      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'on' : ''}
            onClick={() => { if (t.id === 'today' && tab === 'today') setDate(todayIso()); setTab(t.id) }}
          >
            <span className="icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </>
  )
}
