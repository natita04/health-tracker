import { useState } from 'react'
import type { Store } from '../store'
import { dayIndex, fmt, pad, todayIso } from '../dates'
import { CATEGORIES } from '../types'
import { Badge, CAT_STYLE, Icon } from '../icons'
import { dayStat, insights, startDate, streaks } from '../stats'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** 0 = nothing, 4 = everything done. */
const level = (done: number, total: number) =>
  !total || !done ? 0 : done === total ? 4 : done / total > 2 / 3 ? 3 : done / total > 1 / 3 ? 2 : 1

export default function History({ store, openDay }: { store: Store; openDay: (d: string) => void }) {
  const today = todayIso()
  const [month, setMonth] = useState(today.slice(0, 7)) // YYYY-MM
  const start = startDate(store)
  const cats = CATEGORIES.filter((c) => store.tasks.some((t) => t.category === c.id))
  const tips = insights(store)

  const [y, m] = month.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const lead = dayIndex(`${month}-01`)
  const shift = (n: number) => { const d = new Date(y, m - 1 + n, 1); setMonth(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`) }

  return (
    <>
      <header className="screen-head">
        <div>
          <div className="eyebrow">Your patterns</div>
          <h1>History</h1>
        </div>
      </header>

      <section className="card" aria-label="Insights">
        <div className="card-head"><h2>Insights</h2></div>
        {tips.length ? (
          <ul className="insights">
            {tips.map((t) => (
              <li key={t.id} className={`insight tone-${t.tone}`}><Badge name={t.icon} /><span>{t.text}</span></li>
            ))}
          </ul>
        ) : (
          <p className="muted">Insights show up after a few days of check-ins. Keep going!</p>
        )}
      </section>

      <section className="card" aria-label="Calendar">
        <div className="card-head month-head">
          <button className="circle-btn muted-bg" aria-label="Previous month" onClick={() => shift(-1)}><Icon name="chevron-left" /></button>
          <h2>{new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
          <button className="circle-btn muted-bg" aria-label="Next month" disabled={month >= today.slice(0, 7)} onClick={() => shift(1)}><Icon name="chevron-right" /></button>
        </div>
        <div className="heatmap">
          {WEEKDAYS.map((w, i) => <span key={i} className="wd" aria-hidden="true">{w}</span>)}
          {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const date = `${month}-${pad(i + 1)}`
            const future = date > today
            const before = date < start
            const s = dayStat(store, date)
            const lv = future || before ? 0 : level(s.done, s.total)
            const label = fmt(date, { weekday: 'short', day: 'numeric', month: 'short' }) +
              (future ? ', upcoming' : before ? ', before you started' : `: ${s.done} of ${s.total} done`)
            return (
              <button key={date} className={`cell lv${lv} ${date === today ? 'is-today' : ''} ${future || before ? 'off' : ''}`}
                aria-label={label} disabled={future} onClick={() => openDay(date)}>
                {i + 1}
              </button>
            )
          })}
        </div>
        <div className="legend" aria-hidden="true">
          <span>Less</span>{[0, 1, 2, 3, 4].map((l) => <i key={l} className={`cell lv${l}`} />)}<span>More</span>
        </div>
      </section>

      <div className="stats">
        {cats.map((c) => {
          const s = streaks(store, c.id)
          return (
            <div key={c.id} className={`stat streak tone-${CAT_STYLE[c.id].tone}`}>
              <div className="row"><Badge name={CAT_STYLE[c.id].icon} /><span className="label">{c.label}</span></div>
              <span className="value">{s.current}<small>{s.current === 1 ? 'day' : 'days'}</small></span>
              <span className="label">Best: {s.best} {s.best === 1 ? 'day' : 'days'}</span>
            </div>
          )
        })}
      </div>
    </>
  )
}
