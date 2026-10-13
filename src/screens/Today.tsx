import { useState, type ReactNode } from 'react'
import { tasksFor, type Store } from '../store'
import { formatTime } from '../dates'
import { Badge, CAT_STYLE, Icon } from '../icons'
import DayHeader from './DayHeader'
import { WATER_PORTIONS, WATER_PORTION_L, type Category, type Task } from '../types'

// Sections in page order (after the tiles). Walk and water are tiles of their own.
const SECTIONS: { cat: Category; title: string }[] = [
  { cat: 'MEDS', title: 'Meds & supplements' },
  { cat: 'BEAUTY', title: 'Beauty' },
]

export default function Today({ store, date, setDate }: { store: Store; date: string; setDate: (d: string) => void }) {
  const [exercisesFor, setExercisesFor] = useState<Task | null>(null)
  const list = tasksFor(store.tasks, date)
  const done = store.done[date] ?? new Set<string>()

  // The daily workout goes in the 2-up tile; any other workouts (45 min days) get their own section.
  const workouts = list.filter((t) => t.category === 'WORKOUT')
  const mainWorkout = workouts.find((t) => t.steps?.length) ?? workouts[0]
  const strength = workouts.filter((t) => t !== mainWorkout)
  const walks = list.filter((t) => t.category === 'WALK')
  const waters = list.filter((t) => t.category === 'WATER')

  return (
    <>
      <DayHeader title="Habits" date={date} setDate={setDate} allowFuture />

      <div key={date} className="stack-section fade">
        {(mainWorkout || walks.length > 0 || waters.length > 0) && (
          <div className="grid2">
            {walks.map((t) => (
              <WalkTile key={t.id} task={t} done={done.has(t.id)} onToggle={() => store.toggle(date, t, !done.has(t.id))} />
            ))}
            {waters.map((t) => (
              <WaterTile key={t.id} task={t} done={done} onSet={(n) => store.setWater(date, t, n)} />
            ))}
            {mainWorkout && (
              <section className={`tile tone-sage solo ${done.has(mainWorkout.id) ? 'is-done' : ''}`}>
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
          return (
            <Section key={cat} tone={tone} icon={icon} title={title} counter={`${items.filter((t) => done.has(t.id)).length}/${items.length}`}>
              {items.map((t) => (
                <TaskRow key={t.id} task={t} done={done.has(t.id)} onToggle={() => store.toggle(date, t, !done.has(t.id))} />
              ))}
            </Section>
          )
        })}

      </div>

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
  const pill = isBeauty ? task.details : null
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

/** Walk tile: icon and check on top, then the step goal, big. */
function WalkTile({ task, done, onToggle }: { task: Task; done: boolean; onToggle: () => void }) {
  // The goal, big: "Walk 6,500 steps" -> 6,500 steps, "Walk 30 min" -> 30 min, "Walk 3 km" -> 3 km;
  // otherwise the item's minutes; otherwise the title as is.
  const t = /([\d,.]+)\s*(steps?|min(?:utes?)?|km|kilometers?)\b/i.exec(task.title)
  const m = t ? [t[0], t[1], t[2]] : task.duration_min ? ['', String(task.duration_min), 'min'] : null
  return (
    <section className={`tile tone-sage small-tile ${done ? 'is-done' : ''}`}>
      <div className="tile-top">
        <Badge name="steps" />
        <button className={`check check-round ${done ? 'on' : ''}`} aria-pressed={done} aria-label={`${task.title} done`} onClick={onToggle}>
          {done && <Icon name="tick" size={18} strokeWidth={3} />}
        </button>
      </div>
      <h3>Walk</h3>
      <p className="tile-amount">{m ? <><strong>{m[1]}</strong> {m[2]}</> : task.title}</p>
    </section>
  )
}

/** Water tile: icon and -/+ (0.5 L steps) on top, then litres so far. Done at the full amount. */
function WaterTile({ task, done, onSet }: { task: Task; done: Set<string>; onSet: (n: number) => void }) {
  let count = 0
  while (count < WATER_PORTIONS && done.has(`${task.id}#${count + 1}`)) count++
  const litres = (n: number) => (n * WATER_PORTION_L).toFixed(1)
  return (
    <section className={`tile tone-sky small-tile ${count >= WATER_PORTIONS ? 'is-done' : ''}`}>
      <div className="tile-top">
        <Badge name="droplet" />
        <span className="tile-controls">
          <button className="round-btn" aria-label={`Less water, ${WATER_PORTION_L} L`} disabled={count === 0} onClick={() => onSet(count - 1)}>
            <Icon name="minus" />
          </button>
          <button className="round-btn round-ink" aria-label={`More water, ${WATER_PORTION_L} L`} disabled={count >= WATER_PORTIONS} onClick={() => onSet(count + 1)}>
            <Icon name="plus" />
          </button>
        </span>
      </div>
      <h3>Water</h3>
      <p className="tile-amount" aria-live="polite">
        <strong>{litres(count)}</strong> / {(WATER_PORTIONS * WATER_PORTION_L).toFixed(0)} L
      </p>
    </section>
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
