import { addDays, fmt, todayIso } from '../dates'
import { Icon } from '../icons'

/** Screen title with the day being viewed and previous / next day buttons. */
export default function DayHeader({ title, date, setDate, allowFuture }: {
  title: string; date: string; setDate: (d: string) => void; allowFuture?: boolean
}) {
  const today = todayIso()
  const rel = date === today ? 'Today'
    : date === addDays(today, -1) ? 'Yesterday'
    : date === addDays(today, 1) ? 'Tomorrow'
    : null
  return (
    <header className="screen-head">
      <div>
        <div className="eyebrow">
          {rel && <strong className="eyebrow-rel">{rel}</strong>}
          {fmt(date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
        <h1>{title}</h1>
      </div>
      <div className="head-actions">
        <button className="circle-btn" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}><Icon name="chevron-left" /></button>
        <button className="circle-btn" aria-label="Next day" disabled={!allowFuture && date >= today}
          onClick={() => setDate(addDays(date, 1))}><Icon name="chevron-right" /></button>
      </div>
    </header>
  )
}
