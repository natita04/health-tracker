import { tasksFor, type Store } from '../store'
import { addDays, fmt, todayIso } from '../dates'
import { CATEGORIES, type Category } from '../types'
import { CAT_STYLE, Icon } from '../icons'

export default function History({ store, openDay }: { store: Store; openDay: (d: string) => void }) {
  const today = todayIso()
  // Don't count days from before you started as misses.
  const start = store.tasks.reduce((m, t) => (t.created_at && t.created_at.slice(0, 10) < m ? t.created_at.slice(0, 10) : m), today)
  const since = (n: number) => Array.from({ length: n }, (_, i) => addDays(today, -i)).filter((d) => d >= start)

  const stat = (date: string, cat?: Category) => {
    const scheduled = tasksFor(store.tasks, date).filter((t) => !cat || t.category === cat)
    const done = store.done[date] ?? new Set<string>()
    return { date, done: scheduled.filter((t) => done.has(t.id)).length, total: scheduled.length }
  }

  const pct = (n: number, cat: Category) => {
    let d = 0, t = 0
    for (const day of since(n)) { const s = stat(day, cat); d += s.done; t += s.total }
    return t ? `${Math.round((d * 100) / t)}%` : '-'
  }

  /** Days in a row with everything in this category done. Today counts once it's complete. */
  const streak = (cat: Category) => {
    let count = 0
    for (const day of since(120)) {
      const s = stat(day, cat)
      if (!s.total) continue
      if (s.done === s.total) count++
      else if (day !== today) break
    }
    return count ? `${count} ${count === 1 ? 'day' : 'days'}` : '-'
  }

  const days = since(30).map((d) => stat(d))

  return (
    <>
      <header>
        <p className="muted">Tap a day to see or fix it</p>
        <h1 className="plain-title">History</h1>
      </header>
      <section className="list-card">
        <table className="stats-table">
          <thead><tr><th></th><th>7 days</th><th>30 days</th><th>Streak</th></tr></thead>
          <tbody>
            {CATEGORIES.filter((c) => store.tasks.some((t) => t.category === c.id)).map((c) => (
              <tr key={c.id}><td><span className="cat-cell"><Icon name={CAT_STYLE[c.id].icon} />{c.label}</span></td><td>{pct(7, c.id)}</td><td>{pct(30, c.id)}</td><td>{streak(c.id)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
      <h2 className="cat-title">Last 30 days</h2>
      {days.map((d) => (
        <button key={d.date} className="list-card row dayrow" onClick={() => openDay(d.date)}>
          <span className="daylabel">{fmt(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          <span className="bar grow"><span style={{ width: `${d.total ? (d.done / d.total) * 100 : 0}%` }} /></span>
          <span className="count">{d.total && d.done === d.total ? <Icon name="check-circle" /> : `${d.done}/${d.total}`}</span>
        </button>
      ))}
    </>
  )
}
