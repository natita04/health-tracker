import { useState } from 'react'
import { supabase } from '../supabase'
import { Badge, CAT_STYLE, Icon, type IconName } from '../icons'

const FEATURES: { icon: IconName; tone: string; title: string; text: string }[] = [
  { icon: 'check-circle', tone: CAT_STYLE.WALK.tone, title: 'Daily habits', text: 'Water, supplements, skincare, workouts and steps, ticked off in a tap.' },
  { icon: 'apple', tone: CAT_STYLE.FOOD.tone, title: 'Food without the math', text: 'Snap a photo, say it or type it. Calories and protein are estimated for you.' },
  { icon: 'scale', tone: CAT_STYLE.BEAUTY.tone, title: 'Weight', text: 'Log a weigh-in and see the trend toward your goal.' },
  { icon: 'chart', tone: CAT_STYLE.THANKS.tone, title: 'Insights', text: 'Streaks, averages and what slips on weekends, from your own data.' },
]

export default function Login({ onGuest }: { onGuest: () => void }) {
  const [mode, setMode] = useState<'in' | 'up'>('up')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!email.trim()) return setMsg('Type your email first.')
    if (password.length < 6) return setMsg('The password needs at least 6 characters.')
    setBusy(true); setMsg(null)
    const { data, error } = mode === 'in'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })
    setBusy(false)
    if (error) setMsg(error.message)
    else if (mode === 'up' && !data.session) setMsg('Account created! Check your email for the confirmation link, then sign in.')
  }

  return (
    <main className="page login">
      <header className="login-hero">
        <div className="hero-badge"><Icon name="heart" size={28} /></div>
        <h1 className="plain-title center">Health Tracker</h1>
        <p className="center login-tagline">The small things that keep you well, all in one calm place.</p>
      </header>

      <ul className="features">
        {FEATURES.map((f) => (
          <li key={f.title} className={`feature tone-${f.tone}`}>
            <Badge name={f.icon} />
            <div>
              <h2>{f.title}</h2>
              <p>{f.text}</p>
            </div>
          </li>
        ))}
      </ul>

      <form className="login-card" onSubmit={submit}>
        <div className="chips login-switch" role="tablist" aria-label="Account">
          <button type="button" role="tab" aria-selected={mode === 'up'} className={mode === 'up' ? 'chip on' : 'chip'}
            onClick={() => { setMode('up'); setMsg(null) }}>Create account</button>
          <button type="button" role="tab" aria-selected={mode === 'in'} className={mode === 'in' ? 'chip on' : 'chip'}
            onClick={() => { setMode('in'); setMsg(null) }}>Sign in</button>
        </div>
        <label>Email<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} placeholder="at least 6 characters"
          value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button className="btn-primary" disabled={busy}>{mode === 'in' ? 'Sign in' : 'Create account'}</button>
        {mode === 'up' && <p className="muted small center">You start with a clean slate and pick what to track in a quick setup.</p>}
        {msg && <p className="muted small" role="status">{msg}</p>}
      </form>

      <button className="btn btn-white guest-btn" onClick={onGuest}>View as guest</button>
      <p className="muted small center">See how it works with sample data. Nothing you do is saved.</p>
    </main>
  )
}
