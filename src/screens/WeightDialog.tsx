import { useState } from 'react'

export default function WeightDialog({ initial, onClose, onSave }: {
  initial?: number
  onClose: () => void
  onSave: (kg: number) => void
}) {
  const [text, setText] = useState(initial != null ? initial.toFixed(1) : '')
  const kg = Number(text.replace(',', '.'))
  const valid = text.trim() !== '' && kg >= 20 && kg <= 400

  return (
    <div className="overlay" onClick={onClose}>
      <form className="dialog stack" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (valid) onSave(kg) }}>
        <h2>Log weight</h2>
        <label>Weight (kg)
          <input autoFocus inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. 62.4" />
        </label>
        <div className="row end">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!valid}>Save</button>
        </div>
      </form>
    </div>
  )
}
