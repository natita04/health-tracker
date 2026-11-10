import type { Store } from '../store'
import { addDays, fmt, fromIso, todayIso } from '../dates'
import { Icon } from '../icons'
import { Logo } from '../Logo'
import { dayStat, startDate } from '../stats'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const short = (d: string) => fmt(d, { day: 'numeric', month: 'short' })

/** The app name, a week strip (Sunday first, always 7 days) to pick the day, then the screen's title. */
export default function DayHeader({ store, title, date, setDate, allowFuture }: {
  store: Store; title: string; date: string; setDate: (d: string) => void; allowFuture?: boolean
}) {
  const today = todayIso()
  const start = startDate(store)
  const weekStart = addDays(date, -fromIso(date).getDay())
  const thisWeek = addDays(today, -fromIso(today).getDay())
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const nextDisabled = !allowFuture && weekStart >= thisWeek
  const rel = date === today ? 'Today'
    : date === addDays(today, -1) ? 'Yesterday'
    : date === addDays(today, 1) ? 'Tomorrow'
    : null
  return (
    <header className="app-head">
      <Logo />
      <section className="card week-card" aria-label="Week">
        <div className="card-head month-head">
          <button className="circle-btn muted-bg" aria-label="Previous week" onClick={() => setDate(addDays(date, -7))}><Icon name="chevron-left" /></button>
          <h2>{weekStart === thisWeek ? 'This week' : `${short(weekStart)} - ${short(addDays(weekStart, 6))}`}</h2>
          <button className="circle-btn muted-bg" aria-label="Next week" disabled={nextDisabled}
            onClick={() => { const n = addDays(date, 7); setDate(!allowFuture && n > today ? today : n) }}><Icon name="chevron-right" /></button>
        </div>
        <div className="week-strip">
          {days.map((d, i) => {
            const future = d > today
            const counted = !future && d >= start
            const s = dayStat(store, d)
            const label = fmt(d, { weekday: 'long', day: 'numeric', month: 'short' }) +
              (counted && s.total ? `: ${s.done} of ${s.total} done` : '')
            return (
              <button key={d} className={`day-cell ${d === date ? 'is-selected' : ''} ${d === today ? 'is-now' : ''}`}
                aria-label={label} aria-pressed={d === date} disabled={future && !allowFuture} onClick={() => setDate(d)}>
                <span className="wd" aria-hidden="true">{WEEKDAYS[i]}</span>
                <span className="dn" aria-hidden="true">{Number(d.slice(8))}</span>
                <span className="dc" aria-hidden="true">{counted && s.total ? `${s.done}/${s.total}` : ''}</span>
              </button>
            )
          })}
        </div>
      </section>
      <div className="screen-title">
        <div className="eyebrow">
          {rel && <strong className="eyebrow-rel">{rel}</strong>}
          {fmt(date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
        <h1>{title}</h1>
      </div>
    </header>
  )
}
