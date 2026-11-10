import { useRef, useState } from 'react'
import type { Store } from '../store'
import { addDays, fmt, todayIso } from '../dates'
import { Badge, CAT_STYLE, Icon } from '../icons'
import DayHeader from './DayHeader'
import { PROMPTS } from '../thanks'
import { celebrateThanks } from '../celebrate'

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
  const [adding, setAdding] = useState(false)
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
      <DayHeader store={store} title="Thank you" date={date} setDate={setDate} />

      <section className={`section tone-${CAT_STYLE.THANKS.tone}`}>
        <div className="section-head">
          <Badge name="heart" />
          <div>
            <h2>Thoughts</h2>
          </div>
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
      </section>

      <button className="fab" aria-label="Add a thank you" disabled={!store.thoughtsReady} onClick={() => setAdding(true)}>
        <Icon name="plus" size={26} />
      </button>

      {adding && (
        <div className="overlay" onClick={() => setAdding(false)}>
          <form className="dialog stack" role="dialog" aria-modal="true" aria-label="Add a thank you" onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault()
              const v = text.trim()
              if (!v || !store.thoughtsReady) return
              void store.addThought(date, v)
              if (items.length === 2) celebrateThanks(date)
              setText('')
              setHint(null)
              input.current?.focus()
            }}
          >
            <div className="row">
              <h2 className="grow">{date === today ? 'Today I\'m thankful for' : 'I\'m thankful for'}</h2>
              <button type="button" className="hint-chip" onClick={nudge}>
                <Icon name="sparkle" size={14} />{hint ? 'Another nudge' : 'Need a nudge?'}
              </button>
            </div>
            {hint && <p className="nudge-text" aria-live="polite">{hint}</p>}
            <label className="sr-only" htmlFor="thought-input">Something you're thankful for</label>
            <input id="thought-input" ref={input} autoFocus dir="auto" value={text} onChange={(e) => setText(e.target.value)}
              placeholder="Something good..." maxLength={500} enterKeyHint="done" autoComplete="off" />
            <div className="row end">
              <span className="grow" />
              <button type="button" className="btn btn-muted" onClick={() => setAdding(false)}>Done</button>
              <button className="btn btn-ink" disabled={!text.trim()}>Add</button>
            </div>
          </form>
        </div>
      )}

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
          <button className="earlier-btn" onClick={() => setShowEarlier(true)}>Show earlier days</button>
        )
      )}
    </>
  )
}
