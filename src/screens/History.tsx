import { useEffect, useRef, useState } from 'react'
import { tasksFor, type Store } from '../store'
import { addDays, dayIndex, fmt, todayIso } from '../dates'
import { CATEGORIES, TRACKED, WATER_PORTIONS, WATER_PORTION_L, type Category } from '../types'
import { Badge, CAT_STYLE, Icon } from '../icons'
import { dayStat, insights, startDate, streaks } from '../stats'
import FoodHistory from './FoodHistory'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DETAIL_DAYS = 30

type Tile = Category | 'FOOD'

const short = (d: string) => fmt(d, { day: 'numeric', month: 'short' })
const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`

export default function History({ store, openDay }: { store: Store; openDay: (d: string) => void }) {
  const today = todayIso()
  const thisWeek = addDays(today, -dayIndex(today)) // Monday
  const [week, setWeek] = useState(thisWeek)
  const [open, setOpen] = useState<Tile | null>(null)
  const start = startDate(store)
  const cats = TRACKED.filter((c) => store.tasks.some((t) => t.category === c.id))
  const tips = insights(store)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(week, i))
  const toggle = (t: Tile) => setOpen((p) => (p === t ? null : t))
  const detail = useRef<HTMLDivElement>(null)
  // The section opens under all the tiles, so bring it into view.
  useEffect(() => { if (open) detail.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [open])

  // Food tile: average over the last 7 full days that have something logged.
  const foodDays: Record<string, number> = {}
  for (const f of store.food) foodDays[f.date] = (foodDays[f.date] ?? 0) + f.kcal
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, -i - 1)).filter((d) => foodDays[d] != null)
  const avgKcal = last7.length ? Math.round(last7.reduce((s, d) => s + foodDays[d], 0) / last7.length) : null

  return (
    <>
      <header className="screen-head">
        <div>
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

      <section className="card week-card" aria-label="Week">
        <div className="card-head month-head">
          <button className="circle-btn muted-bg" aria-label="Previous week" onClick={() => setWeek(addDays(week, -7))}><Icon name="chevron-left" /></button>
          <h2>{week === thisWeek ? 'This week' : `${short(week)} - ${short(addDays(week, 6))}`}</h2>
          <button className="circle-btn muted-bg" aria-label="Next week" disabled={week >= thisWeek} onClick={() => setWeek(addDays(week, 7))}><Icon name="chevron-right" /></button>
        </div>
        <div className="week-strip">
          {weekDays.map((d, i) => {
            const future = d > today
            const counted = !future && d >= start
            const s = dayStat(store, d)
            const label = fmt(d, { weekday: 'long', day: 'numeric', month: 'short' }) +
              (future ? ', upcoming' : counted ? `: ${s.done} of ${s.total} done` : '')
            return (
              <button key={d} className={`day-cell ${d === today ? 'is-today' : ''}`} aria-label={label} disabled={future} onClick={() => openDay(d)}>
                <span className="wd" aria-hidden="true">{WEEKDAYS[i]}</span>
                <span className="dn" aria-hidden="true">{Number(d.slice(8))}</span>
                <span className="dc" aria-hidden="true">{counted && s.total ? `${s.done}/${s.total}` : ''}</span>
              </button>
            )
          })}
        </div>
      </section>

      <div className="stats">
        {cats.map((c) => {
          const s = streaks(store, c.id)
          return (
            <button key={c.id} className={`stat streak tone-${CAT_STYLE[c.id].tone}`} aria-pressed={open === c.id} onClick={() => toggle(c.id)}>
              <span className="row"><Badge name={CAT_STYLE[c.id].icon} /><span className="label">{c.label}</span></span>
              <span className="value">{s.current}<small>{s.current === 1 ? 'day' : 'days'}</small></span>
            </button>
          )
        })}
        <button className={`stat streak tone-${CAT_STYLE.FOOD.tone}`} aria-pressed={open === 'FOOD'} onClick={() => toggle('FOOD')}>
          <span className="row"><Badge name="apple" /><span className="label">Food</span></span>
          {/* Average over the last 7 days, in one line so the tile matches the others' height. */}
          <span className="value">{avgKcal != null ? <>{avgKcal.toLocaleString('en-US')}<small>kcal/day</small></> : '-'}</span>
        </button>
      </div>

      <div ref={detail} className="detail-anchor">
        {open === 'FOOD' && <FoodHistory store={store} />}
        {open && open !== 'FOOD' && <CategoryDetail store={store} cat={open} onClose={() => setOpen(null)} />}
      </div>
    </>
  )
}

/** The last 30 days of one category: how often it got done, item by item. */
function CategoryDetail({ store, cat, onClose }: { store: Store; cat: Category; onClose: () => void }) {
  const today = todayIso()
  const start = startDate(store)
  const info = CATEGORIES.find((c) => c.id === cat)!
  const { tone, icon } = CAT_STYLE[cat]
  // Full days only: today is still in progress.
  const from = addDays(today, -DETAIL_DAYS)
  const range = Array.from({ length: DETAIL_DAYS }, (_, i) => addDays(from, i)).filter((d) => d >= start)

  let done = 0, total = 0
  for (const d of range) { const s = dayStat(store, d, cat); done += s.done; total += s.total }
  const items = store.tasks
    .filter((t) => t.category === cat)
    .map((t) => {
      const sched = range.filter((d) => tasksFor([t], d).length)
      return { t, sched: sched.length, done: sched.filter((d) => store.done[d]?.has(t.id)).length }
    })
    .filter((x) => x.sched > 0)
  const s = streaks(store, cat)

  const extra = (() => {
    if (cat === 'WATER') {
      const water = store.tasks.find((t) => t.category === 'WATER')
      const ds = water ? range.slice(-7).filter((d) => tasksFor([water], d).length) : []
      if (!water || !ds.length) return null
      const litres = ds.reduce((sum, d) => {
        let n = 0
        while (n < WATER_PORTIONS && store.done[d]?.has(`${water.id}#${n + 1}`)) n++
        return sum + n * WATER_PORTION_L
      }, 0) / ds.length
      return `${litres.toFixed(1)} L a day on average, last 7 days`
    }
    if (cat === 'WEIGH') {
      const w = store.weights.filter((x) => x.date >= from)
      if (w.length < 2) return w.length ? '1 weigh-in in the last 30 days' : null
      const diff = w[w.length - 1].kg - w[0].kg
      return `${w.length} weigh-ins in the last 30 days, ${diff <= 0 ? 'down' : 'up'} ${Math.abs(diff).toFixed(1)} kg`
    }
    return null
  })()

  return (
    <section className={`section tone-${tone}`} aria-label={info.label}>
      <div className="section-head">
        <Badge name={icon} />
        <div>
          <h2>{info.label}</h2>
          <div className="sub">Last {DETAIL_DAYS} days</div>
        </div>
        <button className="icon-btn detail-close" aria-label="Close" onClick={onClose}><Icon name="x" /></button>
      </div>
      {!total ? (
        <p className="empty-line">Nothing to show yet. Check things off on Today and it fills in here.</p>
      ) : (
        <>
          <div className="detail-stats">
            <div><span className="big">{Math.round((done * 100) / total)}%</span><span className="small">checked off ({done} of {total})</span></div>
            <div><span className="big">{s.current}</span><span className="small">day streak · best {s.best}</span></div>
          </div>
          {extra && <p className="detail-extra">{extra}</p>}
          {items.map(({ t, sched, done: d }) => (
            <div key={t.id} className="food-row detail-row">
              <span className="food-body">
                <span className="food-name">{t.title}</span>
                <span className="food-meta">Done {d} of {days(sched)}</span>
              </span>
              <span className="detail-bar" aria-hidden="true"><span style={{ width: `${(d / sched) * 100}%` }} /></span>
            </div>
          ))}
        </>
      )}
    </section>
  )
}
