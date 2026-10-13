import { useRef, useState } from 'react'
import type { Store } from '../store'
import { addDays, fmt, todayIso } from '../dates'
import { Badge, Icon } from '../icons'
import { PROMPTS, THANKS_TARGET } from '../thanks'

/** A random prompt, never the same one twice in a row. */
const randomPrompt = (current: string | null) => {
  const pool = PROMPTS.filter((p) => p !== current)
  return pool[Math.floor(Math.random() * pool.length)]
}

export default function Thanks({ store }: { store: Store }) {
  const today = todayIso()
  const [text, setText] = useState('')
  const [hint, setHint] = useState<string | null>(null)
  const [showEarlier, setShowEarlier] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const items = store.thoughts[today] ?? []
  const pastDays = Object.keys(store.thoughts).filter((d) => d < today && store.thoughts[d].length).sort().reverse()

  // A prompt to answer (in any language); shown in full above the input.
  function nudge() {
    setHint(randomPrompt(hint))
    input.current?.focus()
  }

  return (
    <>
      <header className="screen-head">
        <div>
          <div className="eyebrow">{fmt(today, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
          <h1>Thank you</h1>
        </div>
      </header>

      <section className="section tone-butter">
        <div className="section-head">
          <Badge name="heart" />
          <div>
            <h2>Today</h2>
            <div className="sub">Aim for {THANKS_TARGET} a day</div>
          </div>
          <span className="counter">{items.length}/{THANKS_TARGET}</span>
        </div>
        {!store.thoughtsReady ? (
          <p className="empty-line">Thoughts can't be saved yet: the database needs its one-time update (the SQL from setup).</p>
        ) : items.length === 0 ? (
          <p className="empty-line">Nothing yet today. What made you smile?</p>
        ) : (
          items.map((t, i) => (
            <div key={t.id} className="thought">
              <span className="num">{i + 1}</span>
              <span className="thought-text" dir="auto">{t.text}</span>
              <button className="icon-btn" aria-label="Remove" onClick={() => void store.removeThought(today, t.id)}><Icon name="x" /></button>
            </div>
          ))
        )}
        {hint && <p className="nudge-text" aria-live="polite">{hint}</p>}
        <form
          className="add-form"
          onSubmit={(e) => {
            e.preventDefault()
            const v = text.trim()
            if (!v || !store.thoughtsReady) return
            void store.addThought(today, v)
            setText('')
            setHint(null)
            input.current?.focus()
          }}
        >
          <label className="sr-only" htmlFor="thought-input">Something you're thankful for</label>
          <input id="thought-input" ref={input} dir="auto" value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Today I'm thankful for..." maxLength={500} disabled={!store.thoughtsReady} enterKeyHint="done" autoComplete="off" />
          <button className="add-btn" aria-label="Add thank you thought" disabled={!store.thoughtsReady}><Icon name="plus" /></button>
        </form>
        <button type="button" className="text-btn nudge-btn" disabled={!store.thoughtsReady} onClick={nudge}>
          <Icon name="sparkle" size={16} />{hint ? 'Another nudge' : 'Need a nudge?'}
        </button>
      </section>

      {pastDays.length > 0 && (
        showEarlier ? (
          <section className="entries" aria-label="Earlier days">
            {pastDays.map((d) => (
              <div key={d} className="past-day">
                <div className="past-date">{d === addDays(today, -1) ? 'Yesterday' : fmt(d, { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                <ul>
                  {store.thoughts[d].map((t) => <li key={t.id} dir="auto">{t.text}</li>)}
                </ul>
              </div>
            ))}
            <button className="more" onClick={() => setShowEarlier(false)}>Hide earlier days</button>
          </section>
        ) : (
          <button className="btn btn-white earlier-btn" onClick={() => setShowEarlier(true)}>Show earlier days</button>
        )
      )}
    </>
  )
}
