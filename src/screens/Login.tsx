import { useState } from 'react'
import { supabase } from '../supabase'
import { Icon } from '../icons'
import { APP_NAME } from '../brand'

/** Sign in or create an account. Reached from the landing page. */
export default function Login({ mode: start, onBack }: { mode: 'in' | 'up'; onBack: () => void }) {
  const [mode, setMode] = useState(start)
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

  const swap = (m: 'in' | 'up') => { setMode(m); setMsg(null) }

  return (
    <main className="page login">
      <button className="icon-btn btn-white login-back" aria-label="Back" onClick={onBack}><Icon name="chevron-left" /></button>

      <header className="login-hero">
        <div className="hero-badge"><Icon name="heart" size={28} /></div>
        <h1 className="plain-title center">{mode === 'in' ? 'Welcome back' : `Join ${APP_NAME}`}</h1>
        <p className="center login-tagline">
          {mode === 'in' ? 'Sign in to pick up where you left off.' : 'Free, private, and set up in about a minute.'}
        </p>
      </header>

      <form className="login-card" onSubmit={submit}>
        <div className="chips login-switch" role="tablist" aria-label="Account">
          <button type="button" role="tab" aria-selected={mode === 'up'} className={mode === 'up' ? 'chip on' : 'chip'}
            onClick={() => swap('up')}>Create account</button>
          <button type="button" role="tab" aria-selected={mode === 'in'} className={mode === 'in' ? 'chip on' : 'chip'}
            onClick={() => swap('in')}>Sign in</button>
        </div>
        <label>Email<input type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} placeholder="at least 6 characters"
          value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button className="btn-primary" disabled={busy}>{busy ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
        {mode === 'up' && <p className="muted small center">You start with a clean slate and pick what to track in a quick setup.</p>}
        {msg && <p className="muted small" role="status">{msg}</p>}
      </form>

      <p className="muted small center">
        {mode === 'in' ? 'New here? ' : 'Already have an account? '}
        <button type="button" className="text-btn" onClick={() => swap(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? 'Create an account' : 'Sign in'}
        </button>
      </p>
    </main>
  )
}
