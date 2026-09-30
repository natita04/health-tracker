import { useState } from 'react'
import { supabase } from '../supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: { preventDefault(): void }, mode: 'in' | 'up') {
    e.preventDefault()
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
      <div className="hero">💗</div>
      <h1>Health Tracker</h1>
      <p className="muted">Your daily plan, weight and streaks.</p>
      <form className="card stack" onSubmit={(e) => submit(e, 'in')}>
        <label>Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" autoComplete="current-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button className="primary" disabled={busy}>Sign in</button>
        <button type="button" className="ghost" disabled={busy || !email || password.length < 6} onClick={(e) => submit(e, 'up')}>
          First time? Create account
        </button>
        {msg && <p className="muted small">{msg}</p>}
      </form>
    </main>
  )
}
