import { useState } from 'react'
import { tasksFor, type Store } from '../store'
import { addDays, fmt, formatTime, todayIso } from '../dates'
import { quoteFor } from '../quotes'
import { CATEGORIES, WATER_PORTIONS, WATER_PORTION_L, type Task } from '../types'
import WeightDialog from './WeightDialog'

export default function Today({ store, date, setDate }: { store: Store; date: string; setDate: (d: string) => void }) {
  const [weighing, setWeighing] = useState(false)
  const [, rerender] = useState(0)
  const today = todayIso()
  const list = tasksFor(store.tasks, date)
  const done = store.done[date] ?? new Set<string>()
  const count = list.filter((t) => done.has(t.id)).length
  const weight = store.weights.find((w) => w.date === date)
  const q = quoteFor(date)

  const label = date === today ? 'Today'
    : date === addDays(today, -1) ? 'Yesterday'
    : date === addDays(today, 1) ? 'Tomorrow'
    : fmt(date, { weekday: 'long' })

  return (
    <>
      <header className="dayhead">
        <button className="round" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>‹</button>
        <div>
          <h1>{label}</h1>
          <div className="muted small">{fmt(date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
          {date !== today && <button className="link" onClick={() => setDate(today)}>Back to today</button>}
        </div>
        <button className="round" aria-label="Next day" onClick={() => setDate(addDays(date, 1))}>›</button>
      </header>

      <section className="card accent">
        <strong>{list.length > 0 && count === list.length ? 'All done, you rock! 🎉' : `${count} of ${list.length} done`}</strong>
        <div className="bar"><div style={{ width: `${list.length ? (count / list.length) * 100 : 0}%` }} /></div>
        <p className="quote">“{q.text}”</p>
        <p className="small">- {q.author}</p>
      </section>

      {(weight || !isDismissed(date)) && (
        <section className="card row">
          <div className="grow">
            <strong>⚖️ {weight ? 'Weighed in ✓' : 'Weigh in'}</strong>
            <div className="muted small">{weight ? `${weight.kg.toFixed(1)} kg` : 'Morning, after the bathroom, before eating'}</div>
          </div>
          <button className="tonal" onClick={() => setWeighing(true)}>{weight ? 'Edit' : 'Log'}</button>
          {!weight && (
            <button className="icon close" aria-label="Not today" title="Not today"
              onClick={() => { dismiss(date); rerender((n) => n + 1) }}>✕</button>
          )}
        </section>
      )}

      {CATEGORIES.filter((c) => c.id !== 'WEIGH').map((c) => {
        const items = list.filter((t) => t.category === c.id)
        if (!items.length) return null
        return (
          <section key={c.id}>
            <h2>{c.emoji} {c.label}</h2>
            {items.map((t) => t.category === 'WATER' ? (
              <WaterRow key={t.id} task={t} done={done} onSet={(n) => store.setWater(date, t, n)} />
            ) : (
              <TaskRow key={t.id} task={t} done={done.has(t.id)} onToggle={(on) => store.toggle(date, t, on)} />
            ))}
          </section>
        )
      })}

      {weighing && (
        <WeightDialog
          initial={weight?.kg}
          onClose={() => setWeighing(false)}
          onSave={(kg) => { void store.saveWeight(date, kg); setWeighing(false) }}
        />
      )}
    </>
  )
}

function TaskRow({ task, done, onToggle }: { task: Task; done: boolean; onToggle: (on: boolean) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`task ${done ? 'done' : ''}`}>
      <label className="taskmain">
        <input type="checkbox" checked={done} onChange={(e) => onToggle(e.target.checked)} />
        <span className="grow">
          <span className="title">{task.time_minutes != null && <b className="time">{formatTime(task.time_minutes)}</b>}{task.title}</span>
          {task.details && <span className="muted small block">{task.details}</span>}
        </span>
      </label>
      <div className="actions">
        {task.steps?.length ? (
          <button className="tonal small" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Exercises'}</button>
        ) : null}
      </div>
      {task.videos?.length ? (
        <div className="videos">
          <span className="muted small">{task.videos.length > 1 ? 'Pick one:' : 'Video:'}</span>
          {task.videos.map((v) => (
            <a key={v.url} className="video" href={v.url} target="_blank" rel="noreferrer">▶ {v.title}</a>
          ))}
        </div>
      ) : null}
      {open && task.steps && <Steps steps={task.steps} />}
    </div>
  )
}

function WaterRow({ task, done, onSet }: { task: Task; done: Set<string>; onSet: (n: number) => void }) {
  let count = 0
  while (count < WATER_PORTIONS && done.has(`${task.id}#${count + 1}`)) count++
  const full = count >= WATER_PORTIONS
  return (
    <div className={`task ${full ? 'done' : ''}`}>
      <div className="row">
        <span className="grow title">{task.title}</span>
        <b className="water-total">{(count * WATER_PORTION_L).toFixed(1)} / {(WATER_PORTIONS * WATER_PORTION_L).toFixed(0)} L</b>
      </div>
      <div className="bottles">
        {Array.from({ length: WATER_PORTIONS }, (_, i) => (
          <button
            key={i}
            className={`bottle ${i < count ? 'full' : ''}`}
            aria-label={`${((i + 1) * WATER_PORTION_L).toFixed(1)} L`}
            onClick={() => onSet(i + 1 === count ? i : i + 1)}
          >
            <span />
          </button>
        ))}
      </div>
      <div className="muted small">{full ? 'Fully hydrated 🎉' : 'Tap a bottle each time you finish 0.5 L. Tap the last one again to undo.'}</div>
    </div>
  )
}

function Steps({ steps }: { steps: string[] }) {
  const [ticked, setTicked] = useState<Set<number>>(new Set())
  return (
    <ul className="steps">
      {steps.map((s, i) =>
        s.startsWith('# ') ? (
          <li key={i} className="stephead">{s.slice(2)}</li>
        ) : (
          <li key={i}>
            <label>
              <input
                type="checkbox"
                checked={ticked.has(i)}
                onChange={() => setTicked((p) => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n })}
              />
              {s}
            </label>
          </li>
        ),
      )}
    </ul>
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
