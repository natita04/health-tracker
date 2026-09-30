import { useState } from 'react'
import type { Store } from '../store'
import { addDays, fmt, fromIso, todayIso } from '../dates'
import type { Weight } from '../types'
import WeightDialog from './WeightDialog'

const signed = (d: number) => `${d > 0 ? '+' : ''}${d.toFixed(1)} kg`

export default function WeightScreen({ store }: { store: Store }) {
  const [open, setOpen] = useState(false)
  const today = todayIso()
  const w = store.weights
  const todayEntry = w.find((x) => x.date === today)
  const latest = w[w.length - 1]
  const weekAgo = latest ? [...w].reverse().find((x) => x.date <= addDays(latest.date, -7)) : undefined

  return (
    <>
      <h1>Weight</h1>
      <p className="muted small">Thursday is weigh-in day, but you can log any day.</p>
      <button className="primary wide" onClick={() => setOpen(true)}>{todayEntry ? "Edit today's weight" : "Log today's weight"}</button>

      {latest ? (
        <>
          <section className="card stats">
            <div><b>{latest.kg.toFixed(1)} kg</b><span>Latest</span></div>
            <div><b>{signed(latest.kg - w[0].kg)}</b><span>Since start</span></div>
            <div><b>{weekAgo ? signed(latest.kg - weekAgo.kg) : '-'}</b><span>vs a week ago</span></div>
          </section>
          {w.length >= 2 && <Chart points={w.slice(-60)} />}
          <h2>Entries</h2>
          {[...w].reverse().map((x) => (
            <div key={x.date} className="card row slim">
              <span className="grow">{fmt(x.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <b>{x.kg.toFixed(1)} kg</b>
              <button className="icon" aria-label="Delete" onClick={() => { if (confirm('Delete this entry?')) void store.deleteWeight(x.date) }}>🗑️</button>
            </div>
          ))}
        </>
      ) : (
        <p className="muted center">No entries yet. Log your first one above!</p>
      )}

      {open && (
        <WeightDialog initial={todayEntry?.kg} onClose={() => setOpen(false)}
          onSave={(kg) => { void store.saveWeight(today, kg); setOpen(false) }} />
      )}
    </>
  )
}

function Chart({ points }: { points: Weight[] }) {
  const W = 320, H = 140, P = 8
  const days = points.map((p) => fromIso(p.date).getTime() / 86_400_000)
  const min = Math.min(...points.map((p) => p.kg))
  const max = Math.max(...points.map((p) => p.kg))
  const span = Math.max(days[days.length - 1] - days[0], 1)
  const range = Math.max(max - min, 0.5)
  const xy = points.map((p, i) => [
    P + ((days[i] - days[0]) / span) * (W - 2 * P),
    P + (1 - (p.kg - min) / range) * (H - 2 * P),
  ])
  return (
    <section className="card">
      <div className="row"><strong className="grow">Trend</strong><span className="muted small">{min.toFixed(1)} - {max.toFixed(1)} kg</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Weight trend">
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1={P} x2={W - P} y1={P + (i * (H - 2 * P)) / 3} y2={P + (i * (H - 2 * P)) / 3} className="grid" />
        ))}
        <polyline points={xy.map((p) => p.join(',')).join(' ')} className="line" />
        {xy.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3.5} className="dot" />)}
      </svg>
      <div className="row muted small">
        <span className="grow">{fmt(points[0].date, { day: 'numeric', month: 'short' })}</span>
        <span>{fmt(points[points.length - 1].date, { day: 'numeric', month: 'short' })}</span>
      </div>
    </section>
  )
}
