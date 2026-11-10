import { useEffect, useState } from 'react'
import { disablePush, enablePush, readPush, sendTestPush, syncTimeZone, type PushStatus } from '../push'
import { isOn, type Store } from '../store'
import { fmt, formatTime, parseTime, todayIso } from '../dates'
import { MORE_WORKOUTS_URL } from '../defaults'
import { ALL_DAYS, AREAS, areaOf, CATEGORIES, parseStepsTitle, PARTS, partRank, stepsTitle, type Category, type PartOfDay, type StepUnit, type Task } from '../types'
import { Logo } from '../Logo'
import { areaStyle, Badge, CAT_STYLE, Icon } from '../icons'

// Display order Sun..Sat, with their days_mask bit (Monday = bit 0).
const WEEK: [string, number][] = [['Sun', 6], ['Mon', 0], ['Tue', 1], ['Wed', 2], ['Thu', 3], ['Fri', 4], ['Sat', 5]]
const LETTER: Record<string, string> = { Sun: 'S', Mon: 'M', Tue: 'T', Wed: 'W', Thu: 'T', Fri: 'F', Sat: 'S' }

const daysLabel = (t: Task) =>
  t.every_days ? (t.every_days === 1 ? 'Every day' : `Every ${t.every_days} days`)
    : t.days_mask === ALL_DAYS ? 'Every day' : WEEK.filter(([, b]) => t.days_mask & (1 << b)).map(([n]) => n).join(', ')

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
      <header className="app-head">
        <Logo label="Settings" />
      </header>

      {/* Every group is the same white card: icon, title and subtitle, then grey rows. */}
      <div className="settings stack-section">
        <TrackCard store={store} />
        {(isOn(store, 'WATER') || isOn(store, 'FOOD') || isOn(store, 'WALK')) && <GoalsCard store={store} />}

        {/* Water and Steps are set under Daily goals, so they have no list of their own. */}
        {CATEGORIES.filter((c) => c.id !== 'WATER' && c.id !== 'WALK').map((c) => {
          const items = store.tasks
            .filter((t) => t.category === c.id)
            .sort((a, b) => partRank(a) - partRank(b) || (a.time_minutes ?? -1) - (b.time_minutes ?? -1) || a.sort_order - b.sort_order)
          const reminders = c.id === 'CHORE'
          // The Reminders section always shows: it's where this device's notifications get turned on.
          if (!items.length && !reminders) return null
          return (
            <section key={c.id} className={`section tone-${CAT_STYLE[c.id].tone}`}>
              <div className="section-head">
                <Badge name={CAT_STYLE[c.id].icon} />
                <div>
                  <h2>{c.label}</h2>
                </div>
              </div>
              {items.map((t) => (
                <button key={t.id} className="task-row planrow" onClick={() => setEditing({ task: t, isNew: false })}>
                  <span className="task-body">
                    <span className="task-title">{t.title}</span>
                    <span className="task-note">
                      {[whenLabel(t), daysLabel(t),
                        t.duration_min && `${t.duration_min} min`,
                        t.start_date && `from ${fmt(t.start_date, { day: 'numeric', month: 'short' })}`,
                        t.end_date && `until ${fmt(t.end_date, { day: 'numeric', month: 'short' })}`, t.videos?.length && `▶ ${t.videos.length} video${t.videos.length > 1 ? 's' : ''}`, t.steps?.length && 'exercise list']
                        .filter(Boolean).join(' · ')}
                    </span>
                    {t.details.trim() && <span className="task-note one-line">{t.details}</span>}
                  </span>
                  <Icon name="chevron-right" />
                </button>
              ))}
              {reminders && <ReminderDevice store={store} empty={!items.length} />}
            </section>
          )
        })}

        <section className="section">
          <div className="section-head">
            <Badge name="user" />
            <div><h2>Account</h2></div>
          </div>
          <div className="quiet-list">
            <button className="quiet-row" onClick={store.restartOnboarding}><Icon name="sliders" size={20} />Run setup again<Icon name="chevron-right" size={16} /></button>
            <button className="quiet-row" onClick={() => void store.exportBackup()}><Icon name="download" size={20} />Download backup<Icon name="chevron-right" size={16} /></button>
            <button className="quiet-row quiet-danger" onClick={() => void store.signOut()}><Icon name="logout" size={20} />{store.isGuest ? 'Exit guest view' : 'Sign out'}</button>
          </div>
        </section>
      </div>

      <button className="fab" aria-label="Add item" onClick={addNew}><Icon name="plus" size={26} /></button>

      {editing && (
        <EditDialog
          task={editing.task}
          categories={CATEGORIES.filter((c) => c.id !== 'WATER' && c.id !== 'WALK').filter((c) => { const a = areaOf(c.id); return !a || isOn(store, a) })}
          isNew={editing.isNew}
          onClose={() => setEditing(null)}
          onSave={(t) => { void store.saveTask(t); setEditing(null) }}
          onRemove={() => { void store.archiveTask(editing.task); setEditing(null) }}
        />
      )}
    </>
  )
}

/** Parts of the app you use. Off hides them everywhere; their items and history are kept for when you turn them back on. */
function TrackCard({ store }: { store: Store }) {
  return (
    <section className="section">
      <div className="section-head">
        <Badge name="sliders" />
        <div>
          <h2>What you track</h2>
        </div>
      </div>
      {AREAS.map((a) => {
        const on = isOn(store, a.id)
        return (
          <button key={a.id} role="switch" aria-checked={on} className="task-row planrow"
            onClick={() => void store.setHidden(a.id, on)}>
            <span className={`tone-${areaStyle(a.id).tone} area-icon`}><Icon name={areaStyle(a.id).icon} /></span>
            <span className="task-body"><span className="task-title">{a.label}</span></span>
            <span className="switch" aria-hidden />
          </button>
        )
      })}
    </section>
  )
}

/** Daily water, calorie and protein goals in one card; each field saves when you leave it. */
function GoalsCard({ store }: { store: Store }) {
  const [water, setWater] = useState(String(store.waterGoal))
  const litres = Number(water.replace(',', '.'))
  const waterOk = litres >= 0.5 && litres <= 8

  function saveWater() {
    if (!waterOk) return
    const l = Math.round(litres * 2) / 2 // the tile counts in 0.5 L glasses
    setWater(String(l))
    if (l !== store.waterGoal) void store.setWaterGoal(l)
  }

  const walk = store.tasks.find((t) => t.category === 'WALK' && !t.archived)
  const walkParsed = walk ? parseStepsTitle(walk.title) : null
  const [stepUnit, setStepUnit] = useState<StepUnit>(walkParsed?.unit ?? 'steps')
  const [stepGoal, setStepGoal] = useState(String(walkParsed?.n ?? 10000))
  const stepOk = Number(stepGoal) >= 1
  function saveSteps(unit: StepUnit, text: string) {
    const n = Math.round(Number(text))
    if (!walk || !(n >= 1)) return
    const title = stepsTitle(unit, n)
    setStepGoal(String(n))
    if (title !== walk.title) void store.saveTask({ ...walk, title })
  }
  function pickUnit(unit: StepUnit) {
    if (unit === stepUnit) return
    const n = unit === 'steps' ? '10000' : '45'
    setStepUnit(unit); setStepGoal(n); saveSteps(unit, n)
  }

  const [kcal, setKcal] = useState(String(store.foodGoals.kcal))
  const [protein, setProtein] = useState(String(store.foodGoals.protein))
  const [msg, setMsg] = useState<string | null>(null)
  const num = (t: string) => Number(t.replace(',', '.'))
  const kcalOk = kcal.trim() !== '' && num(kcal) >= 500 && num(kcal) <= 10000
  const proteinOk = protein.trim() !== '' && num(protein) > 0 && num(protein) <= 1000

  function save() {
    if (!kcalOk || !proteinOk) return setMsg('Calories need to be 500 to 10,000 and protein more than 0.')
    const next = { kcal: Math.round(num(kcal)), protein: Math.round(num(protein) * 10) / 10 }
    if (next.kcal === store.foodGoals.kcal && next.protein === store.foodGoals.protein) return setMsg(null)
    void store.setFoodGoals(next)
    setMsg('Saved.')
  }

  return (
    <section className="section">
      <div className="section-head">
        <Badge name="droplet" />
        <div><h2>Daily goals</h2></div>
      </div>
      <div className="notify-body">
        {isOn(store, 'WATER') && (
          <label className="time-row goal-row">Water
            <input inputMode="decimal" value={water} className={waterOk ? '' : 'invalid'}
              onChange={(e) => setWater(e.target.value)} onBlur={saveWater} />
            <span>L</span>
          </label>
        )}
        {isOn(store, 'WALK') && walk && (
          <label className="time-row goal-row steps-row">Walking
            <input inputMode="numeric" value={stepGoal} className={stepOk ? '' : 'invalid'}
              onChange={(e) => setStepGoal(e.target.value.replace(/\D/g, '').slice(0, 6))} onBlur={() => saveSteps(stepUnit, stepGoal)} />
            <button type="button" className="unit-btn" aria-label={`Counting ${stepUnit === 'steps' ? 'steps' : 'minutes'}, tap to switch`}
              onClick={() => pickUnit(stepUnit === 'steps' ? 'min' : 'steps')}>{stepUnit === 'steps' ? 'steps' : 'min'}<Icon name="chevron-right" size={12} /></button>
          </label>
        )}
        {isOn(store, 'FOOD') && <>
        <label className="time-row goal-row">Calories, at most
          <input inputMode="numeric" value={kcal} className={kcalOk ? '' : 'invalid'}
            onChange={(e) => setKcal(e.target.value)} onBlur={save} />
          <span>kcal</span>
        </label>
        <label className="time-row goal-row">Protein, at least
          <input inputMode="decimal" value={protein} className={proteinOk ? '' : 'invalid'}
            onChange={(e) => setProtein(e.target.value)} onBlur={save} />
          <span>g</span>
        </label>
        </>}
        {msg && <p className="empty-line" role="status">{msg}</p>}
      </div>
    </section>
  )
}

/** Turn push notifications on or off for this device; lives at the bottom of the Reminders section. */
function ReminderDevice({ store, empty }: { store: Store; empty: boolean }) {
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (store.isGuest) return
    readPush().then((s) => { setStatus(s); if (s === 'on') void syncTimeZone() }).catch(() => setStatus('off'))
  }, [store.isGuest])

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true); setMsg(null)
    try { await fn(); if (ok) setMsg(ok) } catch (e) { setMsg(`Something went wrong: ${(e as Error).message}`) }
    setBusy(false)
  }
  return (
      <div className="notify-body">
        {empty && <p className="empty-line">Nothing yet. Tap Add item and pick Reminders: it pings you on the days and time you choose.</p>}
        {store.isGuest ? (
          <p className="empty-line">Notifications are off in the guest preview.</p>
        ) : status === null ? (
          <p className="empty-line">Checking this device…</p>
        ) : status === 'unsupported' ? (
          <p className="empty-line">This browser can't receive notifications. On iPhone, add the app to your home screen first and open it from there.</p>
        ) : status === 'denied' ? (
          <p className="empty-line">Notifications are blocked for this site. Allow them in your browser's site settings, then come back here.</p>
        ) : (
          <>
            <button role="switch" aria-checked={status === 'on'} disabled={busy} className="task-row planrow"
              onClick={() => status === 'on'
                ? run(async () => { await disablePush(); setStatus('off') }, 'Turned off on this device.')
                : run(async () => setStatus(await enablePush(store.userId)), 'On! Reminders will show up on this device.')}>
              <Icon name="bell" />
              <span className="task-body">
                <span className="task-title">Notifications on this device</span>
                <span className="task-note">{status === 'on' ? 'On' : 'Off'}</span>
              </span>
              <span className="switch" aria-hidden />
            </button>
            {status === 'on' && (
              <button className="quiet-row" disabled={busy} onClick={() => run(sendTestPush, 'Sent! It should pop up in a few seconds.')}><Icon name="send" size={20} />Send a test</button>
            )}
          </>
        )}
        {msg && <p className="empty-line" role="status">{msg}</p>}
      </div>
  )
}

const PLACEHOLDER: Record<Category, string> = {
  WEIGH: 'e.g. Weigh yourself',
  WALK: 'e.g. Walk 10,000 steps',
  WATER: 'e.g. Drink 4 L of water',
  WORKOUT: 'e.g. Leg day',
  MEDS: 'e.g. Vitamin D',
  BEAUTY: 'e.g. Face mask',
  CHORE: 'e.g. Take out the trash',
}

const INSTRUCTIONS_HINT: Partial<Record<Category, string>> = {
  MEDS: 'e.g. With food, keep away from coffee',
  BEAUTY: 'e.g. Wash, toner, moisturiser, sunscreen',
  WORKOUT: 'e.g. 3 rounds, rest 1 min between',
  CHORE: 'Shows in the notification',
}

type When = 'any' | PartOfDay | 'time'
const WHEN: { id: When; label: string }[] = [{ id: 'any', label: 'Any time' }, ...PARTS, { id: 'time', label: 'At a set time' }]

/** "08:00", "Morning" or nothing, for the Settings list. */
const whenLabel = (t: Task) =>
  t.time_minutes != null ? formatTime(t.time_minutes) : PARTS.find((p) => p.id === t.day_part)?.label

function EditDialog({ task, isNew, categories, onClose, onSave, onRemove }: {
  task: Task; isNew: boolean; categories: typeof CATEGORIES; onClose: () => void; onSave: (t: Task) => void; onRemove: () => void
}) {
  const [title, setTitle] = useState(task.title)
  const [details, setDetails] = useState(task.details)
  // A new item starts with no category: picking one is the first step and shapes the rest of the form.
  const [category, setCategory] = useState<Category | null>(isNew ? null : task.category)
  const [days, setDays] = useState(task.days_mask)
  // Repeat on weekdays, or every N days counted from the start date.
  const [byInterval, setByInterval] = useState(Boolean(task.every_days))
  const [every, setEvery] = useState(task.every_days?.toString() ?? '2')
  const [duration, setDuration] = useState(task.duration_min?.toString() ?? '')
  const [time, setTime] = useState(task.time_minutes != null ? formatTime(task.time_minutes) : '')
  // Exact time, a rough part of the day, or no timing at all.
  const [when, setWhen] = useState<When>(task.time_minutes != null ? 'time' : task.day_part ?? 'any')
  const [videos, setVideos] = useState((task.videos ?? []).map((v) => `${v.title} | ${v.url}`).join('\n'))
  const [start, setStart] = useState(task.start_date ?? '')
  const [end, setEnd] = useState(task.end_date ?? '')
  const [steps, setSteps] = useState((task.steps ?? []).join('\n'))
  // Steps items are a goal in steps or minutes; the name is made from it.
  const parsed = parseStepsTitle(task.title)
  const [unit, setUnit] = useState<StepUnit>(parsed?.unit ?? 'steps')
  const [goal, setGoal] = useState(String(parsed?.n ?? 10000))
  const goalOk = Number(goal) >= 1
  const reminder = category === 'CHORE'
  // Reminders always go off at an exact time.
  const timed = reminder || when === 'time'
  const timeOk = !timed || parseTime(time) != null
  const everyOk = Number(every) >= 1 && Number(every) <= 365
  const valid = category != null && (category === 'WALK' ? goalOk : title.trim() !== '') && timeOk && (byInterval ? everyOk : days !== 0) && (!start || !end || start <= end)

  // Videos and the exercise list only belong to workouts.
  const isWorkout = category === 'WORKOUT'

  const save = () => {
    if (!category) return
    const lines = isWorkout ? steps.split('\n').map((s) => s.trim()).filter(Boolean) : []
    const vids = !isWorkout ? [] : videos.split('\n').map((l) => l.trim()).filter(Boolean).map((l, i) => {
      const [a, b] = l.includes('|') ? l.split('|').map((s) => s.trim()) : ['', l]
      return { title: a || `Option ${i + 1}`, url: b }
    })
    onSave({
      ...task, title: category === 'WALK' ? stepsTitle(unit, Number(goal)) : title.trim(), details: details.trim(), category, days_mask: days,
      // Like every_days: only sent once an item has used it.
      day_part: !timed && when !== 'any' ? when : task.day_part ? null : undefined,
      // Left undefined (not sent) for weekday items that never had an interval.
      every_days: byInterval ? Number(every) : task.every_days ? null : undefined,
      duration_min: !reminder && category !== 'WALK' && duration ? Number(duration) : null,
      time_minutes: timed ? parseTime(time) : null,
      videos: vids.length ? vids : null,
      // Every N days needs a day to count from: today when no start date is set.
      start_date: start || (byInterval ? todayIso() : null),
      end_date: end || null,
      steps: lines.length ? lines : null,
    })
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="dialog stack" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (valid) save() }}>
        <h2>{isNew ? 'New item' : 'Edit item'}</h2>

        <span className="label">{isNew && !category ? 'What kind of item?' : 'Category'}</span>
        <div className="chips">
          {categories.map((c) => (
            <button type="button" key={c.id} className={category === c.id ? 'chip on' : 'chip'} onClick={() => setCategory(c.id)}>
              <Icon name={CAT_STYLE[c.id].icon} size={16} />{c.label}
            </button>
          ))}
        </div>

        {category === 'WEIGH' && <span className="muted small">The days you step on the scale. It ticks itself off when you log your weight in the Weight tab.</span>}

        {category && <>
        {category === 'WALK' ? (
          <>
            <span className="label">Daily goal</span>
            <div className="chips">
              <button type="button" aria-pressed={unit === 'steps'} className={unit === 'steps' ? 'chip on' : 'chip'} onClick={() => { setUnit('steps'); if (unit !== 'steps') setGoal('10000') }}>By steps</button>
              <button type="button" aria-pressed={unit === 'min'} className={unit === 'min' ? 'chip on' : 'chip'} onClick={() => { setUnit('min'); if (unit !== 'min') setGoal('45') }}>By time</button>
            </div>
            <label className="every-row">
              <input inputMode="numeric" value={goal} className={goalOk ? '' : 'invalid'} aria-label={unit === 'steps' ? 'Steps a day' : 'Minutes a day'}
                onChange={(e) => setGoal(e.target.value.replace(/\D/g, '').slice(0, 6))} />
              <span>{unit === 'steps' ? 'steps' : 'minutes'}</span>
            </label>
          </>
        ) : (
          <label>Name
            <input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus={isNew}
              placeholder={PLACEHOLDER[category]} />
          </label>
        )}

        <label>Instructions
          <textarea rows={2} value={details} onChange={(e) => setDetails(e.target.value)}
            placeholder={`optional, ${INSTRUCTIONS_HINT[category] ?? 'anything to remember'}`} />
        </label>

        {!reminder && (
          <>
            <span className="label">When</span>
            <div className="chips">
              {WHEN.map((w) => (
                <button type="button" key={w.id} aria-pressed={when === w.id} className={when === w.id ? 'chip on' : 'chip'} onClick={() => setWhen(w.id)}>{w.label}</button>
              ))}
            </div>
          </>
        )}
        <div className="row gap">
          {timed && (
            <label className="grow">{reminder ? 'Reminder time' : 'Time'}
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={timeOk ? '' : 'invalid'} />
            </label>
          )}
          {!reminder && category !== 'WALK' && <label className="grow">How long (min)<input inputMode="numeric" value={duration} placeholder="optional" onChange={(e) => setDuration(e.target.value.replace(/\D/g, '').slice(0, 3))} /></label>}
          {!timed && <span className="grow" />}
        </div>
        {reminder && <span className="muted small">Reminders don't show in the app, they just send you a notification on these days at this time.</span>}

        <span className="label">Repeat</span>
        <div className="chips">
          <button type="button" aria-pressed={!byInterval} className={byInterval ? 'chip' : 'chip on'} onClick={() => setByInterval(false)}>On these days</button>
          <button type="button" aria-pressed={byInterval} className={byInterval ? 'chip on' : 'chip'} onClick={() => setByInterval(true)}>Every few days</button>
        </div>
        {byInterval ? (
          <>
            <label className="every-row">Every
              <input inputMode="numeric" value={every} className={everyOk ? '' : 'invalid'} aria-label="Number of days"
                onChange={(e) => setEvery(e.target.value.replace(/\D/g, '').slice(0, 3))} />
              <span>days</span>
            </label>
            <span className="muted small">Counted from the start date. Leave it blank to start today.</span>
          </>
        ) : (
          <div className="chips day-chips">
            {WEEK.map(([n, b]) => (
              <button type="button" key={n} aria-label={n} aria-pressed={(days & (1 << b)) !== 0}
                className={days & (1 << b) ? 'chip on' : 'chip'} onClick={() => setDays(days ^ (1 << b))}>{LETTER[n]}</button>
            ))}
          </div>
        )}

        <div className="row gap">
          <label className="grow">Starts<input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label className="grow">Ends<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
        </div>
        {isWorkout && (
          <>
            <label>Videos (one per line: Title | link)
              <textarea rows={3} value={videos} onChange={(e) => setVideos(e.target.value)} placeholder="Leg day | https://youtube.com/..." />
            </label>
            <span className="muted small">Ideas: <a href={MORE_WORKOUTS_URL} target="_blank" rel="noreferrer">Heather Robertson's videos</a></span>
            <label>Exercise list (one per line, "# " for a heading)
              <textarea rows={5} value={steps} onChange={(e) => setSteps(e.target.value)} placeholder="optional" />
            </label>
          </>
        )}
        </>}

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
