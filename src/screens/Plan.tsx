import { useState } from 'react'
import type { Store } from '../store'
import { supabase } from '../supabase'
import { formatTime, parseTime } from '../dates'
import { MORE_WORKOUTS_URL } from '../defaults'
import { ALL_DAYS, CATEGORIES, type Category, type Task } from '../types'

// Display order Sun..Sat, with their days_mask bit (Monday = bit 0).
const WEEK: [string, number][] = [['Sun', 6], ['Mon', 0], ['Tue', 1], ['Wed', 2], ['Thu', 3], ['Fri', 4], ['Sat', 5]]

const daysLabel = (mask: number) =>
  mask === ALL_DAYS ? 'Every day' : WEEK.filter(([, b]) => mask & (1 << b)).map(([n]) => n).join(', ')

export default function Plan({ store }: { store: Store }) {
  const [editing, setEditing] = useState<{ task: Task; isNew: boolean } | null>(null)

  const addNew = () => setEditing({
    isNew: true,
    task: {
      id: `custom_${crypto.randomUUID().slice(0, 8)}`, category: 'BEAUTY', title: '', details: '',
      duration_min: null, days_mask: ALL_DAYS, time_minutes: null, link: null, steps: null,
      sort_order: Math.max(0, ...store.tasks.map((t) => t.sort_order)) + 1, archived: false,
    },
  })

  return (
    <>
      <h1>Plan</h1>
      <p className="muted small">Tap an item to change it. Changes and history are saved to your account.</p>

      {CATEGORIES.map((c) => {
        const items = store.tasks
          .filter((t) => t.category === c.id)
          .sort((a, b) => (a.time_minutes ?? -1) - (b.time_minutes ?? -1) || a.sort_order - b.sort_order)
        if (!items.length) return null
        return (
          <section key={c.id}>
            <h2>{c.emoji} {c.label}</h2>
            {items.map((t) => (
              <button key={t.id} className="card row slim planrow" onClick={() => setEditing({ task: t, isNew: false })}>
                <span className="grow">
                  <span className="title block">{t.title}</span>
                  <span className="muted small">
                    {[daysLabel(t.days_mask), t.time_minutes != null && formatTime(t.time_minutes),
                      t.duration_min && `${t.duration_min} min`, t.link && '▶ video', t.steps?.length && 'exercise list']
                      .filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span aria-hidden>✏️</span>
              </button>
            ))}
          </section>
        )
      })}

      <section className="card stack">
        <strong>Account</strong>
        <div className="row wrap">
          <button className="ghost" onClick={() => void store.exportBackup()}>Download backup</button>
          <button className="ghost" onClick={() => void supabase.auth.signOut()}>Sign out</button>
        </div>
      </section>

      <button className="fab" onClick={addNew}>＋ Add item</button>

      {editing && (
        <EditDialog
          task={editing.task}
          isNew={editing.isNew}
          onClose={() => setEditing(null)}
          onSave={(t) => { void store.saveTask(t); setEditing(null) }}
          onRemove={() => { void store.archiveTask(editing.task); setEditing(null) }}
        />
      )}
    </>
  )
}

function EditDialog({ task, isNew, onClose, onSave, onRemove }: {
  task: Task; isNew: boolean; onClose: () => void; onSave: (t: Task) => void; onRemove: () => void
}) {
  const [title, setTitle] = useState(task.title)
  const [details, setDetails] = useState(task.details)
  const [category, setCategory] = useState<Category>(task.category)
  const [days, setDays] = useState(task.days_mask)
  const [duration, setDuration] = useState(task.duration_min?.toString() ?? '')
  const [time, setTime] = useState(task.time_minutes != null ? formatTime(task.time_minutes) : '')
  const [link, setLink] = useState(task.link ?? '')
  const [steps, setSteps] = useState((task.steps ?? []).join('\n'))

  const timeOk = !time.trim() || parseTime(time) != null
  const valid = title.trim() !== '' && timeOk && days !== 0

  const save = () => {
    const lines = steps.split('\n').map((s) => s.trim()).filter(Boolean)
    onSave({
      ...task, title: title.trim(), details: details.trim(), category, days_mask: days,
      duration_min: duration ? Number(duration) : null,
      time_minutes: time.trim() ? parseTime(time) : null,
      link: link.trim() || null,
      steps: lines.length ? lines : null,
    })
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="dialog stack" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (valid) save() }}>
        <h2>{isNew ? 'New item' : 'Edit item'}</h2>
        <label>Name<input value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
        <label>Notes<input value={details} onChange={(e) => setDetails(e.target.value)} /></label>

        <span className="label">Category</span>
        <div className="chips">
          {CATEGORIES.map((c) => (
            <button type="button" key={c.id} className={category === c.id ? 'chip on' : 'chip'} onClick={() => setCategory(c.id)}>
              {c.emoji} {c.label}
            </button>
          ))}
        </div>

        <span className="label">Days</span>
        <div className="chips">
          {WEEK.map(([n, b]) => (
            <button type="button" key={n} className={days & (1 << b) ? 'chip on' : 'chip'} onClick={() => setDays(days ^ (1 << b))}>{n}</button>
          ))}
          <button type="button" className={days === ALL_DAYS ? 'chip on' : 'chip'} onClick={() => setDays(ALL_DAYS)}>All</button>
        </div>

        <div className="row gap">
          <label className="grow">Minutes<input inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value.replace(/\D/g, '').slice(0, 3))} /></label>
          <label className="grow">Time (HH:MM)<input value={time} onChange={(e) => setTime(e.target.value)} placeholder="optional" className={timeOk ? '' : 'invalid'} /></label>
        </div>
        <label>Video link<input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="optional" /></label>
        <span className="muted small">Ideas: <a href={MORE_WORKOUTS_URL} target="_blank" rel="noreferrer">Heather Robertson's videos</a></span>
        <label>Exercise list (one per line, "# " for a heading)
          <textarea rows={5} value={steps} onChange={(e) => setSteps(e.target.value)} placeholder="optional" />
        </label>

        <div className="row end">
          {!isNew && (
            <button type="button" className="danger" onClick={() => { if (confirm(`Remove "${task.title}" from your plan? Its history is kept.`)) onRemove() }}>
              Remove
            </button>
          )}
          <span className="grow" />
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!valid}>Save</button>
        </div>
      </form>
    </div>
  )
}
