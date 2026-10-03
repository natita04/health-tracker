import { useEffect, useState } from 'react'
import { disablePush, enablePush, readPush, sendTestPush, setPushTime, type PushState } from '../push'
import type { Store } from '../store'
import { fmt, formatTime, parseTime } from '../dates'
import { MORE_WORKOUTS_URL } from '../defaults'
import { ALL_DAYS, CATEGORIES, type Category, type Task } from '../types'
import { Badge, CAT_STYLE, Icon } from '../icons'

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
      duration_min: null, days_mask: ALL_DAYS, time_minutes: null, videos: null, steps: null, start_date: null, end_date: null,
      sort_order: Math.max(0, ...store.tasks.map((t) => t.sort_order)) + 1, archived: false,
    },
  })

  return (
    <>
      <header>
        <p className="muted">Tap an item to change it</p>
        <h1 className="plain-title">Plan</h1>
      </header>

      <MorningCard store={store} />

      {CATEGORIES.map((c) => {
        const items = store.tasks
          .filter((t) => t.category === c.id)
          .sort((a, b) => (a.time_minutes ?? -1) - (b.time_minutes ?? -1) || a.sort_order - b.sort_order)
        if (!items.length) return null
        return (
          <section key={c.id}>
            <h2 className="cat-title"><Badge name={CAT_STYLE[c.id].icon} />{c.label}</h2>
            {items.map((t) => (
              <button key={t.id} className="list-card row planrow" onClick={() => setEditing({ task: t, isNew: false })}>
                <span className="grow">
                  <span className="title block">{t.title}</span>
                  <span className="muted small">
                    {[daysLabel(t.days_mask), t.time_minutes != null && formatTime(t.time_minutes),
                      t.duration_min && `${t.duration_min} min`,
                      t.start_date && `from ${fmt(t.start_date, { day: 'numeric', month: 'short' })}`,
                      t.end_date && `until ${fmt(t.end_date, { day: 'numeric', month: 'short' })}`, t.videos?.length && `▶ ${t.videos.length} video${t.videos.length > 1 ? 's' : ''}`, t.steps?.length && 'exercise list']
                      .filter(Boolean).join(' · ')}
                  </span>
                </span>
                <Icon name="chevron-right" />
              </button>
            ))}
          </section>
        )
      })}

      <section className="list-card stack">
        <strong>Account</strong>
        <div className="row wrap">
          <button className="btn btn-muted" onClick={() => void store.exportBackup()}>Download backup</button>
          <button className="btn btn-muted" onClick={() => void store.signOut()}>{store.isGuest ? 'Exit guest view' : 'Sign out'}</button>
        </div>
      </section>

      <button className="fab" onClick={addNew}><Icon name="plus" />Add item</button>

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

function MorningCard({ store }: { store: Store }) {
  const [state, setState] = useState<PushState | null>(null)
  const [time, setTime] = useState('05:00')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (store.isGuest) return
    readPush().then((s) => { setState(s); setTime(formatTime(s.minutes)) }).catch(() => setState({ status: 'off', minutes: 300 }))
  }, [store.isGuest])

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true); setMsg(null)
    try { await fn(); if (ok) setMsg(ok) } catch (e) { setMsg(`Something went wrong: ${(e as Error).message}`) }
    setBusy(false)
  }
  const minutes = parseTime(time) ?? 300

  return (
    <section className="section tone-butter">
      <div className="section-head">
        <Badge name="bell" />
        <div><h2>Morning notification</h2><div className="sub">Your plan for the day, every morning</div></div>
      </div>
      <div className="notify-body">
        {store.isGuest ? (
          <p className="empty-line">Notifications are off in the guest preview.</p>
        ) : state === null ? (
          <p className="empty-line">Checking this device…</p>
        ) : state.status === 'unsupported' ? (
          <p className="empty-line">This browser can't receive notifications. On iPhone, add the app to your home screen first and open it from there.</p>
        ) : state.status === 'denied' ? (
          <p className="empty-line">Notifications are blocked for this site. Allow them in your browser's site settings, then come back here.</p>
        ) : (
          <>
            <label className="time-row">Time
              <input type="time" value={time} disabled={busy}
                onChange={(e) => {
                  setTime(e.target.value)
                  const m = parseTime(e.target.value)
                  if (state.status === 'on' && m != null) void run(() => setPushTime(m), `Saved, see you at ${e.target.value}.`)
                }} />
            </label>
            <div className="row wrap">
              {state.status === 'on' ? (
                <>
                  <button className="btn btn-ink" disabled={busy} onClick={() => run(sendTestPush, 'Sent! It should pop up in a few seconds.')}>Send a test</button>
                  <button className="btn btn-white" disabled={busy}
                    onClick={() => run(async () => { await disablePush(); setState({ status: 'off', minutes }) }, 'Turned off on this device.')}>Turn off</button>
                </>
              ) : (
                <button className="btn btn-ink" disabled={busy}
                  onClick={() => run(async () => { const st = await enablePush(store.userId, minutes); setState({ status: st, minutes }) }, `On! First one tomorrow at ${time}.`)}>
                  Turn on for this device
                </button>
              )}
            </div>
          </>
        )}
        {msg && <p className="empty-line" role="status">{msg}</p>}
      </div>
    </section>
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
  const [videos, setVideos] = useState((task.videos ?? []).map((v) => `${v.title} | ${v.url}`).join('\n'))
  const [start, setStart] = useState(task.start_date ?? '')
  const [end, setEnd] = useState(task.end_date ?? '')
  const [steps, setSteps] = useState((task.steps ?? []).join('\n'))

  const timeOk = !time.trim() || parseTime(time) != null
  const valid = title.trim() !== '' && timeOk && days !== 0 && (!start || !end || start <= end)

  const save = () => {
    const lines = steps.split('\n').map((s) => s.trim()).filter(Boolean)
    const vids = videos.split('\n').map((l) => l.trim()).filter(Boolean).map((l, i) => {
      const [a, b] = l.includes('|') ? l.split('|').map((s) => s.trim()) : ['', l]
      return { title: a || `Option ${i + 1}`, url: b }
    })
    onSave({
      ...task, title: title.trim(), details: details.trim(), category, days_mask: days,
      duration_min: duration ? Number(duration) : null,
      time_minutes: time.trim() ? parseTime(time) : null,
      videos: vids.length ? vids : null,
      start_date: start || null,
      end_date: end || null,
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
              <Icon name={CAT_STYLE[c.id].icon} size={16} />{c.label}
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
        <div className="row gap">
          <label className="grow">Starts<input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label className="grow">Ends<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
        </div>
        <label>Videos (one per line: Title | link)
          <textarea rows={3} value={videos} onChange={(e) => setVideos(e.target.value)} placeholder="Leg day | https://youtube.com/..." />
        </label>
        <span className="muted small">Ideas: <a href={MORE_WORKOUTS_URL} target="_blank" rel="noreferrer">Heather Robertson's videos</a></span>
        <label>Exercise list (one per line, "# " for a heading)
          <textarea rows={5} value={steps} onChange={(e) => setSteps(e.target.value)} placeholder="optional" />
        </label>

        <div className="row end">
          {!isNew && (
            <button type="button" className="btn btn-danger" onClick={() => { if (confirm(`Remove "${task.title}" from your plan? Its history is kept.`)) onRemove() }}>
              Remove
            </button>
          )}
          <span className="grow" />
          <button type="button" className="btn btn-muted" onClick={onClose}>Cancel</button>
          <button className="btn btn-ink" disabled={!valid}>Save</button>
        </div>
      </form>
    </div>
  )
}
