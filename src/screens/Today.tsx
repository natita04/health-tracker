import { useState } from 'react'
import { tasksFor, type Store } from '../store'
import { addDays, fmt, formatTime, todayIso } from '../dates'
import { quoteFor } from '../quotes'
import { CATEGORIES, type Task } from '../types'
import WeightDialog from './WeightDialog'

export default function Today({ store, date, setDate }: { store: Store; date: string; setDate: (d: string) => void }) {
  const [weighing, setWeighing] = useState(false)
  const today = todayIso()
  const list = tasksFor(store.tasks, date)
  const done = store.done[date] ?? new Set<string>()
  const count = list.filter((t) => done.has(t.id)).length
  const weighDay = list.some((t) => t.category === 'WEIGH')
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

      <section className="card row">
        <div className="grow">
          <strong>{weighDay ? '⚖️ Weigh-in day!' : '⚖️ Weight'}</strong>
          <div className="muted small">
            {weight ? `${weight.kg.toFixed(1)} kg logged` : weighDay ? 'Morning, before eating' : 'Log anytime you like'}
          </div>
        </div>
        <button className="tonal" onClick={() => setWeighing(true)}>{weight ? 'Edit' : 'Log'}</button>
      </section>

      {CATEGORIES.filter((c) => c.id !== 'WEIGH').map((c) => {
        const items = list.filter((t) => t.category === c.id)
        if (!items.length) return null
        return (
          <section key={c.id}>
            <h2>{c.emoji} {c.label}</h2>
            {items.map((t) => (
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
        {task.link && <a className="tonal small" href={task.link} target="_blank" rel="noreferrer">▶ Video</a>}
      </div>
      {open && task.steps && <Steps steps={task.steps} />}
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
