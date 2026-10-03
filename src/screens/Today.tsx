import { useRef, useState, type ReactNode } from 'react'
import { tasksFor, type Store } from '../store'
import { addDays, fmt, formatTime, todayIso } from '../dates'
import { quoteFor } from '../quotes'
import { Badge, CAT_STYLE, Icon } from '../icons'
import { WATER_PORTIONS, WATER_PORTION_L, type Category, type Task } from '../types'
import WeightDialog from './WeightDialog'

const THANKS_TARGET = 3
// Sections in page order (after the 2-up tiles).
const SECTIONS: { cat: Category; title: string }[] = [
  { cat: 'WALK', title: 'Walk' },
  { cat: 'WATER', title: 'Water' },
  { cat: 'MEDS', title: 'Meds & supplements' },
  { cat: 'BEAUTY', title: 'Beauty' },
]

export default function Today({ store, date, setDate }: { store: Store; date: string; setDate: (d: string) => void }) {
  const [weighing, setWeighing] = useState(false)
  const [exercisesFor, setExercisesFor] = useState<Task | null>(null)
  const [, rerender] = useState(0)
  const today = todayIso()
  const list = tasksFor(store.tasks, date)
  const done = store.done[date] ?? new Set<string>()
  const weight = store.weights.find((w) => w.date === date)
  const thoughts = store.thoughts[date] ?? []
  const q = quoteFor(date)

  // The daily workout goes in the 2-up tile; any other workouts (45 min days) get their own section.
  const workouts = list.filter((t) => t.category === 'WORKOUT')
  const mainWorkout = workouts.find((t) => t.steps?.length) ?? workouts[0]
  const strength = workouts.filter((t) => t !== mainWorkout)
  const showWeigh = Boolean(weight) || !isDismissed(date)

  // Progress: every task in display order, plus "thank you thoughts" as one more.
  const ordered: { key: string; tone: string; done: boolean }[] = [
    ...(mainWorkout ? [mainWorkout] : []),
    ...strength,
    ...SECTIONS.flatMap((s) => list.filter((t) => t.category === s.cat)),
  ].map((t) => ({ key: t.id, tone: CAT_STYLE[t.category].tone, done: done.has(t.id) }))
  ordered.push({ key: 'thanks', tone: CAT_STYLE.THANKS.tone, done: thoughts.length > 0 })
  const doneCount = ordered.filter((o) => o.done).length
  const pct = Math.round((doneCount / ordered.length) * 100)

  const title = date === today ? 'Today'
    : date === addDays(today, -1) ? 'Yesterday'
    : date === addDays(today, 1) ? 'Tomorrow'
    : fmt(date, { weekday: 'long' })

  return (
    <>
      <header className="screen-head">
        <div>
          <div className="eyebrow">
            {fmt(date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            {date !== today && <button className="text-btn" onClick={() => setDate(today)}>Back to today</button>}
          </div>
          <h1>{title}</h1>
        </div>
        <div className="head-actions">
          <button className="circle-btn" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}><Icon name="chevron-left" /></button>
          <button className="circle-btn" aria-label="Next day" onClick={() => setDate(addDays(date, 1))}><Icon name="chevron-right" /></button>
        </div>
      </header>

      <div key={date} className="stack-section fade">
        <section className="hero" aria-label="Progress">
          <div className="hero-top">
            <div><span className="hero-num">{doneCount}</span><span className="hero-suffix">/ {ordered.length} done</span></div>
            <span className="hero-pct">{pct}%</span>
          </div>
          <div className="segments" role="progressbar" aria-valuemin={0} aria-valuemax={ordered.length} aria-valuenow={doneCount}>
            {ordered.map((o) => <span key={o.key} className={`tone-${o.tone} ${o.done ? 'seg-done' : ''}`} />)}
          </div>
          <p className="quote"><em>“{q.text}”</em>- {q.author}</p>
        </section>

        {(showWeigh || mainWorkout) && (
          <div className="grid2">
            {showWeigh && (
              <section className={`tile tone-sky ${mainWorkout ? '' : 'solo'}`}>
                <Badge name="scale" />
                {!weight && (
                  <button className="icon-btn dismiss" aria-label="Skip weigh-in today" onClick={() => { dismiss(date); rerender((n) => n + 1) }}>
                    <Icon name="x" />
                  </button>
                )}
                <h3>{weight ? 'Weighed in' : 'Weigh in'}</h3>
                <p className="desc">{weight ? `${weight.kg.toFixed(1)} kg` : 'Morning, after the bathroom, before eating'}</p>
                <div className="actions">
                  <button className="btn btn-ink" onClick={() => setWeighing(true)}>{weight ? 'Edit' : 'Log'}</button>
                </div>
              </section>
            )}
            {mainWorkout && (
              <section className={`tile tone-sage ${showWeigh ? '' : 'solo'} ${done.has(mainWorkout.id) ? 'is-done' : ''}`}>
                <Badge name="dumbbell" />
                <h3>Workout</h3>
                <p className="desc">{[mainWorkout.title, mainWorkout.details].filter(Boolean).join(' · ')}</p>
                <div className="actions">
                  {mainWorkout.steps?.length ? (
                    <button className="btn btn-white" onClick={() => setExercisesFor(mainWorkout)}>Exercises</button>
                  ) : null}
                  <button
                    className={`check check-round ${done.has(mainWorkout.id) ? 'on' : ''}`}
                    aria-pressed={done.has(mainWorkout.id)}
                    aria-label={`${mainWorkout.title} done`}
                    onClick={() => store.toggle(date, mainWorkout, !done.has(mainWorkout.id))}
                  >
                    {done.has(mainWorkout.id) && <Icon name="tick" size={18} strokeWidth={3} />}
                  </button>
                </div>
              </section>
            )}
          </div>
        )}

        {strength.length > 0 && (
          <Section tone="sage" icon="dumbbell" title="Strength" counter={`${strength.filter((t) => done.has(t.id)).length}/${strength.length}`}>
            {strength.map((t) => (
              <TaskRow key={t.id} task={t} done={done.has(t.id)} onToggle={() => store.toggle(date, t, !done.has(t.id))} />
            ))}
          </Section>
        )}

        {SECTIONS.map(({ cat, title }) => {
          const items = list.filter((t) => t.category === cat)
          if (!items.length) return null
          const { tone, icon } = CAT_STYLE[cat]
          if (cat === 'WATER') {
            return items.map((t) => <WaterSection key={t.id} task={t} done={done} onSet={(n) => store.setWater(date, t, n)} />)
          }
          return (
            <Section key={cat} tone={tone} icon={icon} title={title} counter={`${items.filter((t) => done.has(t.id)).length}/${items.length}`}>
              {items.map((t) => (
                <TaskRow key={t.id} task={t} done={done.has(t.id)} onToggle={() => store.toggle(date, t, !done.has(t.id))} />
              ))}
            </Section>
          )
        })}

        <Thoughts store={store} date={date} />
      </div>

      {weighing && (
        <WeightDialog
          initial={weight?.kg}
          onClose={() => setWeighing(false)}
          onSave={(kg) => { if (kg != null) void store.saveWeight(date, kg); setWeighing(false) }}
        />
      )}
      {exercisesFor && <ExercisesSheet task={exercisesFor} onClose={() => setExercisesFor(null)} />}
    </>
  )
}

function Section({ tone, icon, title, sub, counter, children }: {
  tone: string; icon: Parameters<typeof Badge>[0]['name']; title: string; sub?: string; counter?: string; children: ReactNode
}) {
  return (
    <section className={`section tone-${tone}`}>
      <div className="section-head">
        <Badge name={icon} />
        <div>
          <h2>{title}</h2>
          {sub && <div className="sub">{sub}</div>}
        </div>
        {counter && <span className="counter">{counter}</span>}
      </div>
      {children}
    </section>
  )
}

function TaskRow({ task, done, onToggle }: { task: Task; done: boolean; onToggle: () => void }) {
  const isBeauty = task.category === 'BEAUTY'
  const pill = isBeauty ? (task.duration_min ? `${task.duration_min} min` : task.details) : null
  const note = isBeauty ? null : task.details
  const row = (
    <button className={`task-row ${done ? 'is-done' : ''}`} aria-pressed={done} onClick={onToggle}>
      <span className={`check ${done ? 'on' : ''}`} aria-hidden="true">{done && <Icon name="tick" size={16} strokeWidth={3} />}</span>
      <span className="task-body">
        <span className="task-title">
          {task.time_minutes != null && <span className="task-time">{formatTime(task.time_minutes)}</span>}
          <span className="task-title-text">{task.title}</span>
        </span>
        {note && <span className="task-note">{note}</span>}
      </span>
      {pill && <span className="task-pill">{pill}</span>}
    </button>
  )
  if (!task.videos?.length) return row
  return (
    <div className="row-wrap">
      {row}
      <div className="video-list">
        <span className="label">{task.videos.length > 1 ? 'Pick one:' : 'Video:'}</span>
        {task.videos.map((v) => (
          <a key={v.url} className="video-link press" href={v.url} target="_blank" rel="noreferrer">
            <Icon name="play" size={16} />{v.title}
          </a>
        ))}
      </div>
    </div>
  )
}

function WaterSection({ task, done, onSet }: { task: Task; done: Set<string>; onSet: (n: number) => void }) {
  let count = 0
  while (count < WATER_PORTIONS && done.has(`${task.id}#${count + 1}`)) count++
  const full = count >= WATER_PORTIONS
  return (
    <Section tone="sky" icon="droplet" title="Water" sub={task.title}
      counter={`${(count * WATER_PORTION_L).toFixed(1)} / ${(WATER_PORTIONS * WATER_PORTION_L).toFixed(0)} L`}>
      <div className="bottles">
        {Array.from({ length: WATER_PORTIONS }, (_, i) => (
          <button
            key={i}
            className={`bottle ${i < count ? 'full' : ''}`}
            aria-label={`${((i + 1) * WATER_PORTION_L).toFixed(1)} L`}
            aria-pressed={i < count}
            onClick={() => onSet(i + 1 === count ? i : i + 1)}
          >
            <span />
          </button>
        ))}
      </div>
      <p className="water-note">{full ? 'Fully hydrated, nice!' : 'Tap a bottle for each 0.5 L. Tap the last one again to undo.'}</p>
    </Section>
  )
}

function Thoughts({ store, date }: { store: Store; date: string }) {
  const [text, setText] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const items = store.thoughts[date] ?? []

  return (
    <Section tone="butter" icon="heart" title="Thank you thoughts" sub={`Aim for ${THANKS_TARGET} a day`} counter={`${items.length}/${THANKS_TARGET}`}>
      {!store.thoughtsReady ? (
        <p className="empty-line">Thoughts can't be saved yet: the database needs its one-time update (the SQL from setup).</p>
      ) : items.length === 0 ? (
        <p className="empty-line">Nothing yet today. What made you smile?</p>
      ) : (
        items.map((t, i) => (
          <div key={t.id} className="thought">
            <span className="num">{i + 1}</span>
            <span className="thought-text">{t.text}</span>
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
          input.current?.focus()
        }}
      >
        <label className="sr-only" htmlFor="thought-input">Something you're thankful for</label>
        <input id="thought-input" ref={input} value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Today I'm thankful for..." maxLength={500} disabled={!store.thoughtsReady} enterKeyHint="done" autoComplete="off" />
        <button className="add-btn" aria-label="Add thank you thought" disabled={!store.thoughtsReady}><Icon name="plus" /></button>
      </form>
    </Section>
  )
}

function ExercisesSheet({ task, onClose }: { task: Task; onClose: () => void }) {
  const [ticked, setTicked] = useState<Set<number>>(new Set())
  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog stack" role="dialog" aria-modal="true" aria-label={task.title} onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <h2 className="grow">{task.title}</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}><Icon name="x" /></button>
        </div>
        <ul className="steps">
          {(task.steps ?? []).map((s, i) =>
            s.startsWith('# ') ? (
              <li key={i} className="stephead">{s.slice(2)}</li>
            ) : (
              <li key={i}>
                <button
                  className={ticked.has(i) ? 'is-done' : ''}
                  aria-pressed={ticked.has(i)}
                  onClick={() => setTicked((p) => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n })}
                >
                  <span className={`check ${ticked.has(i) ? 'on' : ''}`} aria-hidden="true">{ticked.has(i) && <Icon name="tick" size={16} strokeWidth={3} />}</span>
                  <span>{s}</span>
                </button>
              </li>
            ),
          )}
        </ul>
        <button className="btn-primary" onClick={onClose}>Done</button>
      </div>
    </div>
  )
}

// Skipping the weigh-in is remembered per day on this device.
const key = (date: string) => `weigh-dismissed-${date}`
function isDismissed(date: string) {
  try { return localStorage.getItem(key(date)) === '1' } catch { return false }
}
function dismiss(date: string) {
  try { localStorage.setItem(key(date), '1') } catch { /* private mode: just shows again */ }
}
