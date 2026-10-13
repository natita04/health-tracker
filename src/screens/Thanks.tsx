import { useRef, useState } from 'react'
import type { Store, Thought } from '../store'
import { addDays, fmt, todayIso } from '../dates'
import { Badge, Icon } from '../icons'
import { PROMPTS, THANKS_TARGET } from '../thanks'

const PROMPTS_SHOWN = 4
const EARLIER_SHOWN = 7

/** Deterministic shuffle seeded by the day, so prompts change daily but stay put within a day. */
function shuffled<T>(list: T[], seed: number) {
  const out = [...list]
  let x = seed || 1
  for (let i = out.length - 1; i > 0; i--) {
    x = (x * 1103515245 + 12345) % 2147483648
    const j = x % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export default function Thanks({ store }: { store: Store }) {
  const today = todayIso()
  const [text, setText] = useState('')
  const [hint, setHint] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [memorySeed, setMemorySeed] = useState(() => Math.floor(Math.random() * 1e9))
  const [showAllDays, setShowAllDays] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const items = store.thoughts[today] ?? []

  const order = shuffled(PROMPTS, Number(today.replaceAll('-', '')))
  const prompts = Array.from({ length: PROMPTS_SHOWN }, (_, i) => order[(page * PROMPTS_SHOWN + i) % order.length])

  // Earlier days, newest first; one random thought from them as a little reminder.
  const pastDays = Object.keys(store.thoughts).filter((d) => d < today && store.thoughts[d].length).sort().reverse()
  const past: Thought[] = pastDays.flatMap((d) => store.thoughts[d])
  const memory = past.length ? past[memorySeed % past.length] : null
  const daysShown = showAllDays ? pastDays : pastDays.slice(0, EARLIER_SHOWN)

  // The prompt becomes the input's hint, so you can answer it in any language.
  function use(prompt: string) {
    setHint(prompt)
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
            placeholder={hint ? `${hint}...` : "Today I'm thankful for..."} maxLength={500} disabled={!store.thoughtsReady} enterKeyHint="done" autoComplete="off" />
          <button className="add-btn" aria-label="Add thank you thought" disabled={!store.thoughtsReady}><Icon name="plus" /></button>
        </form>
      </section>

      <section className="section tone-peach">
        <div className="section-head">
          <Badge name="sparkle" />
          <div>
            <h2>Need a nudge?</h2>
            <div className="sub">Tap one, then write what comes to mind</div>
          </div>
        </div>
        {prompts.map((p) => (
          <button key={p} className="task-row prompt-row" disabled={!store.thoughtsReady} onClick={() => use(p)}>
            <span className="task-body"><span className="task-title">{p}</span></span>
            <Icon name="chevron-right" />
          </button>
        ))}
        <button className="text-btn more-btn" onClick={() => setPage((n) => n + 1)}>Other ideas</button>
      </section>

      {memory && (
        <section className="section tone-lilac">
          <div className="section-head">
            <Badge name="heart" />
            <div>
              <h2>From your past</h2>
              <div className="sub">{fmt(memory.date, { weekday: 'long', day: 'numeric', month: 'short' })}</div>
            </div>
          </div>
          <p className="memory" dir="auto">“{memory.text}”</p>
          {past.length > 1 && (
            <button className="text-btn more-btn" onClick={() => setMemorySeed((s) => s + 1 + Math.floor(Math.random() * (past.length - 1)))}>
              Another one
            </button>
          )}
        </section>
      )}

      {pastDays.length > 0 && (
        <section className="entries" aria-label="Earlier days">
          {daysShown.map((d) => (
            <div key={d} className="past-day">
              <div className="past-date">{d === addDays(today, -1) ? 'Yesterday' : fmt(d, { weekday: 'short', day: 'numeric', month: 'short' })}</div>
              <ul>
                {store.thoughts[d].map((t) => <li key={t.id} dir="auto">{t.text}</li>)}
              </ul>
            </div>
          ))}
          {pastDays.length > EARLIER_SHOWN && (
            <button className="more" onClick={() => setShowAllDays(!showAllDays)}>
              {showAllDays ? 'Show less' : `Show all ${pastDays.length} days`}
            </button>
          )}
        </section>
      )}
    </>
  )
}
