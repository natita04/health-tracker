import { useRef, useState } from 'react'
import type { Store } from '../store'
import { addDays, fmt, todayIso } from '../dates'
import { Badge, Icon } from '../icons'
import DayHeader from './DayHeader'
import { PROMPTS, THANKS_TARGET } from '../thanks'

/** A random prompt, never the same one twice in a row. */
const randomPrompt = (current: string | null) => {
  const pool = PROMPTS.filter((p) => p !== current)
  return pool[Math.floor(Math.random() * pool.length)]
}

export default function Thanks({ store, date, setDate }: { store: Store; date: string; setDate: (d: string) => void }) {
  const today = todayIso()
  const [text, setText] = useState('')
  const [hint, setHint] = useState<string | null>(null)
  const [showEarlier, setShowEarlier] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const items = store.thoughts[date] ?? []
  // Days before the one on screen that have thoughts, newest first.
  const pastDays = Object.keys(store.thoughts).filter((d) => d < date && store.thoughts[d].length).sort().reverse()

  // A prompt to answer (in any language), shown next to the nudge button.
  function nudge() {
    setHint(randomPrompt(hint))
    input.current?.focus()
  }

  return (
    <>
      <DayHeader title="Thank you" date={date} setDate={setDate} />

      <section className="section tone-butter">
        <div className="section-head">
          <Badge name="heart" />
          <div>
            <h2>{date === today ? 'Today' : fmt(date, { weekday: 'long' })}</h2>
            <div className="sub">What are you thankful for?</div>
          </div>
          <span className="counter">{items.length}/{THANKS_TARGET}</span>
        </div>
        {!store.thoughtsReady ? (
          <p className="empty-line">Thoughts can't be saved yet: the database needs its one-time update (the SQL from setup).</p>
        ) : (
          items.map((t, i) => (
            <div key={t.id} className="thought">
              <span className="num">{i + 1}</span>
              <span className="thought-text" dir="auto">{t.text}</span>
              <button className="icon-btn" aria-label="Remove" onClick={() => void store.removeThought(date, t.id)}><Icon name="x" /></button>
            </div>
          ))
        )}
        <form
          className="add-form"
          onSubmit={(e) => {
            e.preventDefault()
            const v = text.trim()
            if (!v || !store.thoughtsReady) return
            void store.addThought(date, v)
            setText('')
            setHint(null)
            input.current?.focus()
          }}
        >
          <label className="sr-only" htmlFor="thought-input">Something you're thankful for</label>
          <input id="thought-input" ref={input} dir="auto" value={text} onChange={(e) => setText(e.target.value)}
            placeholder={date === today ? "Today I'm thankful for..." : "I'm thankful for..."} maxLength={500} disabled={!store.thoughtsReady} enterKeyHint="done" autoComplete="off" />
          <button className="add-btn" aria-label="Add thank you thought" disabled={!store.thoughtsReady}><Icon name="plus" /></button>
        </form>
        <div className="nudge-row">
          <button type="button" className="text-btn nudge-btn" disabled={!store.thoughtsReady} onClick={nudge}>
            <Icon name="sparkle" size={16} />{hint ? 'Another nudge' : 'Need a nudge?'}
          </button>
          {hint && <span className="nudge-text" aria-live="polite">{hint}</span>}
        </div>
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
