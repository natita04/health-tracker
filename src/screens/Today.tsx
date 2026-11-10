import { useState, type ReactNode } from 'react'
import { tasksFor, type Store } from '../store'
import { formatTime, todayIso } from '../dates'
import { Badge, CAT_STYLE, Icon } from '../icons'
import DayHeader from './DayHeader'
import { celebrateDone, celebrateEvening, celebrateMorning, celebrateWater, useRise } from '../celebrate'
import { PARTS, partOf, WATER_MAX, WATER_PORTION_L, type Category, type Task } from '../types'

// Sections in page order (after the tiles). Steps and water are tiles of their own.
const SECTIONS: { cat: Category; title: string }[] = [
  { cat: 'MEDS', title: 'Meds & supplements' },
  { cat: 'BEAUTY', title: 'Beauty' },
]

export default function Today({ store, date, setDate, onSettings }: {
  store: Store; date: string; setDate: (d: string) => void; onSettings: () => void
}) {
  const [exercisesFor, setExercisesFor] = useState<Task | null>(null)
  const list = tasksFor(store.tasks, date)
  const done = store.done[date] ?? new Set<string>()

  // The daily workout comes first in the Workout section, with any other workouts (45 min days) after it.
  const workouts = list.filter((t) => t.category === 'WORKOUT')
  const mainWorkout = workouts.find((t) => t.steps?.length) ?? workouts[0]
  const workoutRows = mainWorkout ? [mainWorkout, ...workouts.filter((t) => t !== mainWorkout)] : []
  const walks = list.filter((t) => t.category === 'WALK')
  const waters = list.filter((t) => t.category === 'WATER')

  // Everything on today's plan ticked: a perfect day.
  const allDone = list.length > 0 && list.every((t) => done.has(t.id))
  useRise(allDone && date <= todayIso(), date, () => celebrateDone(date))
  // All of the morning's (or the evening's) items ticked.
  const partDone = (p: 'morning' | 'evening') => {
    const items = list.filter((t) => partOf(t) === p)
    return items.length > 0 && items.every((t) => done.has(t.id))
  }
  useRise(partDone('morning') && date <= todayIso(), date, () => celebrateMorning(date))
  useRise(partDone('evening') && date <= todayIso(), date, () => celebrateEvening(date))

  return (
    <>
      <DayHeader store={store} title="Habits" date={date} setDate={setDate} allowFuture />

      <div key={date} className="stack-section fade">
        {list.length === 0 && (
          <section className="section tone-sage">
            <div className="section-head">
              <Badge name="check-circle" />
              <div>
                <h2>Nothing planned{store.tasks.length ? ' this day' : ' yet'}</h2>
                <div className="sub">Add habits like water, supplements or steps in Settings.</div>
              </div>
            </div>
            <div className="row settings-actions">
              <button className="btn btn-white" onClick={onSettings}>Go to Settings</button>
            </div>
          </section>
        )}
        {(walks.length > 0 || waters.length > 0) && (
          <div className="grid2">
            {walks.map((t) => (
              <WalkTile key={t.id} task={t} done={done.has(t.id)} onToggle={() => store.toggle(date, t, !done.has(t.id))} />
            ))}
            {waters.map((t) => (
              <WaterTile key={t.id} task={t} date={date} done={done} goal={store.waterGoal} onSet={(n) => store.setWater(date, t, n)} />
            ))}
          </div>
        )}

        {workoutRows.length > 0 && (
          <Section tone={CAT_STYLE.WORKOUT.tone} icon="dumbbell" title="Workout" counter={`${workoutRows.filter((t) => done.has(t.id)).length}/${workoutRows.length}`}>
            <Rows items={workoutRows} done={done} onToggle={(t) => store.toggle(date, t, !done.has(t.id))} onExercises={setExercisesFor} />
          </Section>
        )}

        {SECTIONS.map(({ cat, title }) => {
          const items = list.filter((t) => t.category === cat)
          if (!items.length) return null
          const { tone, icon } = CAT_STYLE[cat]
          return (
            <Section key={cat} tone={tone} icon={icon} title={title} counter={`${items.filter((t) => done.has(t.id)).length}/${items.length}`}>
              <Rows items={items} done={done} onToggle={(t) => store.toggle(date, t, !done.has(t.id))} />
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

/** A section's items under Morning / Afternoon / Evening / Any time, once any of them has a timing. */
function Rows({ items, done, onToggle, onExercises }: { items: Task[]; done: Set<string>; onToggle: (t: Task) => void; onExercises?: (t: Task) => void }) {
  const row = (t: Task) => <TaskRow key={t.id} task={t} done={done.has(t.id)} onToggle={() => onToggle(t)} onExercises={onExercises} />
  if (items.every((t) => !partOf(t))) return <>{items.map(row)}</>
  const groups = [...PARTS, { id: null, label: 'Any time' }]
    .map((p) => ({ ...p, items: items.filter((t) => partOf(t) === p.id) }))
    .filter((g) => g.items.length)
  return (
    <>
      {groups.map((g) => (
        <div key={g.label} className="part-group">
          <h3 className="part-label">{g.label}</h3>
          {g.items.map(row)}
        </div>
      ))}
    </>
  )
}

function TaskRow({ task, done, onToggle, onExercises }: { task: Task; done: boolean; onToggle: () => void; onExercises?: (t: Task) => void }) {
  const note = task.details.trim()
  const hasSteps = !!onExercises && !!task.steps?.length
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
    </button>
  )
  if (!task.videos?.length && !hasSteps) return row
  return (
    <div className="row-wrap">
      <div className="row-line">
        {row}
        {hasSteps && (
          <button className="icon-btn exercises-btn" aria-label={`Exercises: ${task.title}`} onClick={() => onExercises?.(task)}>
            <Icon name="dumbbell" size={22} />
          </button>
        )}
      </div>
      {!!task.videos?.length && (
        <div className="video-list">
          <span className="label">{task.videos.length > 1 ? 'Pick one:' : 'Video:'}</span>
          {task.videos.map((v) => (
            <a key={v.url} className="video-link press" href={v.url} target="_blank" rel="noreferrer">
              <Icon name="play" size={16} />{v.title}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

/** Steps tile: icon and check on top, then the goal (steps or minutes), big. */
function WalkTile({ task, done, onToggle }: { task: Task; done: boolean; onToggle: () => void }) {
  // The goal, big: "Walk 6,500 steps" -> 6,500 steps, "Walk 30 min" -> 30 min, "Walk 3 km" -> 3 km;
  // otherwise the item's minutes; otherwise the title as is.
  const t = /([\d,.]+)\s*(steps?|min(?:utes?)?|km|kilometers?)\b/i.exec(task.title)
  const m = t ? [t[0], t[1], t[2]] : task.duration_min ? ['', String(task.duration_min), 'min'] : null
  return (
    <section className={`tile tone-${CAT_STYLE.WALK.tone} small-tile ${done ? 'is-done' : ''}`}>
      <div className="tile-top">
        <Badge name="steps" />
        <button className={`check check-round ${done ? 'on' : ''}`} aria-pressed={done} aria-label={`${task.title} done`} onClick={onToggle}>
          {done && <Icon name="tick" size={18} strokeWidth={3} />}
        </button>
      </div>
      <h3>Steps</h3>
      <p className="tile-amount">{m ? <><strong>{m[1]}</strong> {m[2]}</> : task.title}</p>
    </section>
  )
}

/** Water tile: icon and -/+ (0.5 L steps) on top, then litres so far. */
function WaterTile({ task, date, done, goal, onSet }: { task: Task; date: string; done: Set<string>; goal: number; onSet: (n: number) => void }) {
  let count = 0
  while (count < WATER_MAX && done.has(`${task.id}#${count + 1}`)) count++
  const litres = (n: number) => (n * WATER_PORTION_L).toFixed(1)
  // The cheer comes at 2 L (or at your goal, if that is lower).
  const cheerAt = Math.min(goal, 2)
  useRise(count * WATER_PORTION_L >= cheerAt && date <= todayIso(), `${date}:${task.id}`, () => celebrateWater(date, cheerAt))
  return (
    <section className={`tile tone-${CAT_STYLE.WATER.tone} small-tile ${count * WATER_PORTION_L >= goal ? 'is-done' : ''}`}>
      <div className="tile-top">
        <Badge name="droplet" />
        <span className="tile-controls">
          <button className="round-btn" aria-label={`Less water, ${WATER_PORTION_L} L`} disabled={count === 0} onClick={() => onSet(count - 1)}>
            <Icon name="minus" />
          </button>
          <button className="round-btn round-ink" aria-label={`More water, ${WATER_PORTION_L} L`} disabled={count >= WATER_MAX} onClick={() => onSet(count + 1)}>
            <Icon name="plus" />
          </button>
        </span>
      </div>
      <h3>Water</h3>
      <p className="tile-amount" aria-live="polite">
        <strong>{litres(count)}</strong> L
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
