import { useState } from 'react'
import type { Store } from '../store'
import { addDays, fmt, fromIso, todayIso } from '../dates'
import { Icon } from '../icons'
import type { Weight } from '../types'
import WeightDialog from './WeightDialog'

type Range = '1W' | '1M' | '3M' | '1Y' | 'All'
const RANGES: { id: Range; days: number | null; title: string; since: string }[] = [
  { id: '1W', days: 7, title: 'Last 7 days', since: 'in 7 days' },
  { id: '1M', days: 30, title: 'Last 30 days', since: 'in 30 days' },
  { id: '3M', days: 90, title: 'Last 3 months', since: 'in 3 months' },
  { id: '1Y', days: 365, title: 'Last year', since: 'in a year' },
  { id: 'All', days: null, title: 'All time', since: 'since you started' },
]

const kg1 = (n: number) => n.toFixed(1)
const signed = (d: number) => `${d > 0 ? '+' : d < 0 ? '-' : ''}${Math.abs(d).toFixed(1)}`
const dayNum = (s: string) => fromIso(s).getTime() / 86_400_000

export default function WeightScreen({ store }: { store: Store }) {
  const [range, setRange] = useState<Range>('1M')
  const [dialog, setDialog] = useState<null | 'today' | 'other' | 'goal'>(null)
  const [showAll, setShowAll] = useState(false)
  const today = todayIso()
  const all = store.weights
  const latest = all[all.length - 1]
  const first = all[0]
  const todayEntry = all.find((w) => w.date === today)

  const r = RANGES.find((x) => x.id === range)!
  const from = r.days ? addDays(today, -r.days) : (first?.date ?? today)
  const visible = all.filter((w) => w.date >= from)
  const change = visible.length >= 2 ? visible[visible.length - 1].kg - visible[0].kg : null

  const recent = [...all].reverse()
  const shown = showAll ? recent : recent.slice(0, 3)

  return (
    <>
      <header className="screen-head">
        <div>
          <div className="eyebrow">{latest ? `Last weigh-in ${fmt(latest.date, { weekday: 'short', day: 'numeric', month: 'short' })}` : 'No weigh-ins yet'}</div>
          <h1>Weight</h1>
        </div>
        <div className="head-actions">
          <button className="circle-btn" aria-label="Log weight for another day" onClick={() => setDialog('other')}><Icon name="calendar" /></button>
        </div>
      </header>

      <section className="weight-hero">
        <span className="label">Current</span>
        <div><span className="value">{latest ? kg1(latest.kg) : '-'}</span><span className="unit">kg</span></div>
        {change != null && <span className="change-pill">{signed(change)} kg {r.since}</span>}
      </section>

      <section className="card">
        <div className="card-head"><h2>{r.title}</h2><span className="unit">kg</span></div>
        <Chart points={visible} from={from} to={today} title={r.title} />
        <div className="segmented" role="group" aria-label="Chart range">
          {RANGES.map((x) => (
            <button key={x.id} aria-pressed={range === x.id} onClick={() => setRange(x.id)}>{x.id}</button>
          ))}
        </div>
      </section>

      <div className="stats">
        <div className="stat tone-lilac">
          <span className="label">Start</span>
          <span className="value">{first ? <>{kg1(first.kg)}<small>kg</small></> : '-'}</span>
        </div>
        <button className="stat tone-peach" onClick={() => setDialog('goal')} aria-label={store.goal != null ? `Goal ${kg1(store.goal)} kg, change` : 'Set goal'}>
          <span className="label">Goal</span>
          {store.goal != null
            ? <span className="value">{kg1(store.goal)}<small>kg</small></span>
            : <span className="set-goal">Set goal</span>}
        </button>
      </div>

      {recent.length > 0 && (
        <section className="entries" aria-label="Recent entries">
          {shown.map((w) => {
            const idx = all.indexOf(w)
            const prev = idx > 0 ? all[idx - 1] : null
            const d = prev ? w.kg - prev.kg : null
            return (
              <div key={w.date} className="entry">
                <span className="grow">{fmt(w.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                <span className="kg">{kg1(w.kg)}</span>
                {d != null && <span className={`delta ${d < 0 ? 'down' : ''}`}>{signed(d)}</span>}
                {showAll && (
                  <button className="icon-btn" aria-label={`Delete ${fmt(w.date, { day: 'numeric', month: 'short' })}`}
                    onClick={() => { if (confirm('Delete this entry?')) void store.deleteWeight(w.date) }}>
                    <Icon name="x" />
                  </button>
                )}
              </div>
            )
          })}
          {recent.length > 3 || showAll ? (
            <button className="more" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show less' : `Show all ${recent.length} (edit or delete)`}</button>
          ) : null}
        </section>
      )}

      <button className="btn-primary" onClick={() => setDialog('today')}>
        <Icon name="plus" />{todayEntry ? "Edit today's weight" : "Log today's weight"}
      </button>

      {dialog === 'today' && (
        <WeightDialog initial={todayEntry?.kg} onClose={() => setDialog(null)}
          onSave={(kg) => { if (kg != null) void store.saveWeight(today, kg); setDialog(null) }} />
      )}
      {dialog === 'other' && (
        <WeightDialog pickDate title="Log weight for a day" onClose={() => setDialog(null)}
          onSave={(kg, d) => { if (kg != null) void store.saveWeight(d, kg); setDialog(null) }} />
      )}
      {dialog === 'goal' && (
        <WeightDialog title="Weight goal" label="Goal (kg)" initial={store.goal ?? undefined} allowClear onClose={() => setDialog(null)}
          onSave={(kg) => { void store.setGoal(kg); setDialog(null) }} />
      )}
    </>
  )
}

/** Inline SVG line chart (handoff 6.3). */
function Chart({ points, from, to, title }: { points: Weight[]; from: string; to: string; title: string }) {
  const W = 320, H = 170, X0 = 5, X1 = 300, Y0 = 150, Y1 = 30
  const label = points.length
    ? `Weight trend, ${title.toLowerCase()}, ${points.length === 1 ? `${kg1(points[0].kg)} kg` : `from ${kg1(points[0].kg)} to ${kg1(points[points.length - 1].kg)} kg`}`
    : `Weight trend, ${title.toLowerCase()}, no weigh-ins`

  const d0 = dayNum(from)
  const span = Math.max(dayNum(to) - d0, 1)
  const min = Math.min(...points.map((p) => p.kg)) - 0.2
  const max = Math.max(...points.map((p) => p.kg)) + 0.2
  const xy = points.map((p) => [
    X0 + ((dayNum(p.date) - d0) / span) * (X1 - X0),
    Y0 - ((p.kg - min) / (max - min)) * (Y0 - Y1),
  ])
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = xy.length > 1 ? `${line} L${xy[xy.length - 1][0].toFixed(1)},${H} L${xy[0][0].toFixed(1)},${H} Z` : ''
  const last = xy[xy.length - 1]
  const text = points.length ? kg1(points[points.length - 1].kg) : ''
  const bw = text.length * 8.5 + 20, bh = 30
  const bx = last ? Math.min(Math.max(last[0] - bw / 2, 0), W - bw) : 0
  const by = last ? (last[1] - 16 - bh < 0 ? last[1] + 16 : last[1] - 16 - bh) : 0

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {[30, 80, 130].map((y) => <line key={y} className="grid" x1={0} x2={W} y1={y} y2={y} />)}
      {points.length === 0 ? (
        <text className="empty" x={W / 2} y={H / 2 + 5} textAnchor="middle">No weigh-ins yet</text>
      ) : (
        <>
          {area && <path className="area" d={area} />}
          {xy.length > 1 && <path className="line" d={line} />}
          <circle className="last" cx={last[0]} cy={last[1]} r={7} />
          <rect className="bubble" x={bx} y={by} width={bw} height={bh} rx={12} />
          <text className="bubble-text" x={bx + bw / 2} y={by + bh / 2 + 5} textAnchor="middle">{text}</text>
        </>
      )}
    </svg>
  )
}
