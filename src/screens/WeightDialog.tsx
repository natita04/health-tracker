import { useState } from 'react'
import { todayIso } from '../dates'

/** Log (or edit) a weight. With `pickDate`, a date field lets you log a past day too. */
export default function WeightDialog({ initial, onClose, onSave, pickDate, title = 'Log weight', label = 'Weight (kg)', allowClear }: {
  initial?: number
  onClose: () => void
  onSave: (kg: number | null, date: string) => void
  pickDate?: boolean
  title?: string
  label?: string
  allowClear?: boolean
}) {
  const [text, setText] = useState(initial != null ? initial.toFixed(1) : '')
  const [date, setDate] = useState(todayIso())
  const kg = Number(text.replace(',', '.'))
  const valid = text.trim() !== '' && kg >= 20 && kg <= 400 && date !== '' && date <= todayIso()

  return (
    <div className="overlay" onClick={onClose}>
      <form className="dialog stack" role="dialog" aria-modal="true" aria-label={title}
        onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (valid) onSave(kg, date) }}>
        <h2>{title}</h2>
        {pickDate && (
          <label>Date<input type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} /></label>
        )}
        <label>{label}
          <input autoFocus inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. 62.4" />
        </label>
        <div className="row end">
          {allowClear && initial != null && (
            <button type="button" className="btn btn-danger" onClick={() => onSave(null, date)}>Remove</button>
          )}
          <span className="grow" />
          <button type="button" className="btn btn-muted" onClick={onClose}>Cancel</button>
          <button className="btn btn-ink" disabled={!valid}>Save</button>
        </div>
      </form>
    </div>
  )
}
