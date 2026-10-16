import { useState } from 'react'
import type { Store } from '../store'
import { startDate } from '../stats'
import { addDays, fmt, todayIso } from '../dates'

type Range = '1W' | '1M' | '3M'
const RANGES: { id: Range; days: number }[] = [
  { id: '1W', days: 7 },
  { id: '1M', days: 30 },
  { id: '3M', days: 90 },
]

const num = (n: number) => Math.round(n).toLocaleString('en-US')
const short = (d: string) => fmt(d, { day: 'numeric', month: 'short' })

/** Daily calories and protein over time, each against its goal. Days with nothing logged are gaps, not zeros. */
export default function FoodHistory({ store }: { store: Store }) {
  const today = todayIso()
  const { kcal: KCAL_GOAL, protein: PROTEIN_GOAL } = store.foodGoals
  const [range, setRange] = useState<Range>('1M')
  const [selected, setSelected] = useState<string | null>(null)

  const totals: Record<string, { kcal: number; protein: number }> = {}
  const start = startDate(store)
  for (const f of store.food) {
    if (f.date < start) continue
    const t = (totals[f.date] ??= { kcal: 0, protein: 0 })
    t.kcal += f.kcal
    t.protein += f.protein
  }
  if (!Object.keys(totals).length) {
    return (
      <section className="card" aria-label="Food">
        <div className="card-head"><h2>Food</h2></div>
        <p className="muted">Log meals in the Food tab and your daily calories and protein show up here.</p>
      </section>
    )
  }

  const n = RANGES.find((r) => r.id === range)!.days
  const days = Array.from({ length: n }, (_, i) => addDays(today, i - n + 1))
  // Today is still in progress, so it's charted but left out of the averages.
  const past = days.filter((d) => d < today && totals[d])
  const avg = (k: 'kcal' | 'protein') => (past.length ? past.reduce((s, d) => s + totals[d][k], 0) / past.length : null)
  const avgKcal = avg('kcal'), avgProtein = avg('protein')
  const under = past.filter((d) => totals[d].kcal <= KCAL_GOAL).length
  const hit = past.filter((d) => totals[d].protein >= PROTEIN_GOAL).length
  const sel = selected && days.includes(selected) ? selected : null
  const pick = (d: string) => setSelected((p) => (p === d ? null : d))

  return (
    <section className="card" aria-label="Food">
      <div className="card-head"><h2>Food</h2><span className="unit">per day</span></div>
      <p className="food-readout" aria-live="polite">
        {sel
          ? totals[sel]
            ? <><strong>{fmt(sel, { weekday: 'short', day: 'numeric', month: 'short' })}</strong> · {num(totals[sel].kcal)} kcal · {num(totals[sel].protein)} g protein</>
            : <><strong>{fmt(sel, { weekday: 'short', day: 'numeric', month: 'short' })}</strong> · nothing logged</>
          : 'Tap a bar to see that day'}
      </p>

      <DayBars title="Calories" unit="kcal" tone="kcal" goal={KCAL_GOAL} days={days} today={today}
        values={days.map((d) => totals[d]?.kcal ?? null)} selected={sel} onPick={pick} />
      <DayBars title="Protein" unit="g" tone="protein" goal={PROTEIN_GOAL} days={days} today={today}
        values={days.map((d) => totals[d]?.protein ?? null)} selected={sel} onPick={pick} />

      <div className="segmented segmented-3" role="group" aria-label="Food chart range">
        {RANGES.map((r) => (
          <button key={r.id} aria-pressed={range === r.id} onClick={() => setRange(r.id)}>{r.id}</button>
        ))}
      </div>

      <div className="stats">
        <div className="stat tone-peach">
          <span className="label">Avg calories</span>
          <span className="value">{avgKcal != null ? <>{num(avgKcal)}<small>kcal</small></> : '-'}</span>
          {past.length > 0 && <span className="label">{under} of {past.length} days on target</span>}
        </div>
        <div className="stat tone-sage">
          <span className="label">Avg protein</span>
          <span className="value">{avgProtein != null ? <>{num(avgProtein)}<small>g</small></> : '-'}</span>
          {past.length > 0 && <span className="label">{hit} of {past.length} days hit goal</span>}
        </div>
      </div>

    </section>
  )
}

/** One column per day with a goal line. Single series, so the title names it and no legend is needed. */
function DayBars({ title, unit, tone, goal, days, today, values, selected, onPick }: {
  title: string; unit: string; tone: 'kcal' | 'protein'; goal: number; days: string[]; today: string
  values: (number | null)[]; selected: string | null; onPick: (d: string) => void
}) {
  const W = 320, X1 = 284, TOP = 8, BASE = 112, H = 132
  const max = Math.max(goal * 1.15, ...values.map((v) => (v ?? 0) * 1.05))
  const y = (v: number) => BASE - (v / max) * (BASE - TOP)
  const slot = X1 / days.length
  const bw = Math.max(2, Math.min(24, slot - 2))
  const logged = values.filter((v): v is number => v != null)
  const label = `${title} per day, ${short(days[0])} to ${short(days[days.length - 1])}, goal ${num(goal)} ${unit}: ` +
    (logged.length ? `${logged.length} days logged, from ${num(Math.min(...logged))} to ${num(Math.max(...logged))} ${unit}` : 'nothing logged')

  return (
    <figure className="daybars">
      <figcaption>{title} <span className="muted">({unit})</span></figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <line className="grid" x1={0} x2={X1} y1={BASE} y2={BASE} />
        {values.map((v, i) => {
          if (v == null || v <= 0) return null
          const x = i * slot + (slot - bw) / 2
          const top = y(v)
          const r = Math.min(4, bw / 2, BASE - top)
          const dim = selected != null && days[i] !== selected
          return (
            <path key={days[i]} className={`bar-${tone} ${dim ? 'dim' : ''} ${days[i] === today ? 'is-today' : ''}`}
              d={`M${x},${BASE} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${BASE} Z`} />
          )
        })}
        <line className="goal" x1={0} x2={X1} y1={y(goal)} y2={y(goal)} />
        <text className="goal-text" x={X1 + 4} y={y(goal) + 4}>{num(goal)}</text>
        <text className="axis-text" x={0} y={H - 4}>{short(days[0])}</text>
        <text className="axis-text" x={X1} y={H - 4} textAnchor="end">Today</text>
        {/* Hit targets: the whole column, wider than the bar itself. */}
        {days.map((d, i) => (
          <rect key={d} className="hit" x={i * slot} y={0} width={slot} height={BASE}
            onClick={() => onPick(d)}>
            <title>{`${short(d)}: ${values[i] != null ? `${num(values[i]!)} ${unit}` : 'nothing logged'}`}</title>
          </rect>
        ))}
      </svg>
    </figure>
  )
}
