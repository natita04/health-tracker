import { useState, type ReactNode } from 'react'
import type { Onboarding as Picked, Store } from '../store'
import { BASIC_WORKOUT } from '../defaults'
import { todayIso } from '../dates'
import { ALL_DAYS, AREAS, KCAL_GOAL, PROTEIN_GOAL, type Area, type Category, type Task } from '../types'
import { areaStyle, Badge, Icon } from '../icons'

// A quick setup, one part of the app per screen. Everything can be skipped; skipped parts stay hidden
// until they're turned on in Settings.

type Starter = { title: string; extra?: Partial<Task> }
const weekly = (): Partial<Task> => ({ every_days: 7, start_date: todayIso() })

const STARTERS: Record<'MEDS' | 'BEAUTY' | 'WORKOUT', Starter[]> = {
  MEDS: ['Vitamin D', 'Omega 3', 'Magnesium', 'Multivitamin', 'Iron', 'Probiotic', 'B12', 'Collagen'].map((title) => ({ title })),
  BEAUTY: [
    { title: 'Morning skincare', extra: { day_part: 'morning' } },
    { title: 'Sunscreen', extra: { day_part: 'morning' } },
    { title: 'Evening skincare', extra: { day_part: 'evening' } },
    { title: 'Dry brushing' },
    { title: 'Face mask', extra: weekly() },
    { title: 'Hair mask', extra: weekly() },
  ],
  WORKOUT: [
    { title: '15-min bodyweight workout', extra: { details: 'No equipment', duration_min: 15, steps: BASIC_WORKOUT } },
    { title: 'Yoga', extra: { duration_min: 20 } },
    { title: 'Pilates', extra: { duration_min: 30 } },
    { title: 'Run', extra: { duration_min: 30 } },
  ],
}
const WATER_GOALS = [2, 2.5, 3, 4]
const STEP_GOALS = [6000, 8000, 10000]

const QUESTION: Record<Area, { title: string; sub: string; skip: string }> = {
  FOOD: { title: 'Track what you eat?', sub: 'Log meals by text, photo or voice. Calories and protein are estimated for you.', skip: "I don't care about tracking food" },
  WATER: { title: 'How much water a day?', sub: 'A goal to aim for. You log what you actually drink.', skip: "I don't track water" },
  MEDS: { title: 'Meds & supplements', sub: 'Pick what you take, or add your own.', skip: "I don't take any" },
  BEAUTY: { title: 'Beauty routine', sub: 'Pick what you do, or add your own.', skip: 'Skip beauty' },
  WORKOUT: { title: 'Workouts', sub: 'Pick what you do, or add your own.', skip: 'Skip workouts' },
  WALK: { title: 'Daily steps', sub: 'A step goal you tick off each day.', skip: "I don't track steps" },
  WEIGHT: { title: 'Track your weight?', sub: 'A weigh-in on your plan and a chart of how it goes.', skip: "I don't track weight" },
  THANKS: { title: 'Thank you thoughts?', sub: 'A few words a day about something you are grateful for.', skip: 'Skip this' },
}

const sameTitle = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export default function Onboarding({ store, onDone }: { store: Store; onDone: () => void }) {
  const [step, setStep] = useState(0)
  const [skipped, setSkipped] = useState<Set<Area>>(new Set())
  const [kcal, setKcal] = useState(String(store.foodGoals.kcal ?? KCAL_GOAL))
  const [protein, setProtein] = useState(String(store.foodGoals.protein ?? PROTEIN_GOAL))
  const [water, setWater] = useState(store.waterGoal)
  const [picks, setPicks] = useState<Record<'MEDS' | 'BEAUTY' | 'WORKOUT', string[]>>({ MEDS: [], BEAUTY: [], WORKOUT: [] })
  const [own, setOwn] = useState<Record<'MEDS' | 'BEAUTY' | 'WORKOUT', string[]>>({ MEDS: [], BEAUTY: [], WORKOUT: [] })
  const [steps, setSteps] = useState(8000)
  const [weighWeekly, setWeighWeekly] = useState(true)
  const [goalKg, setGoalKg] = useState(store.goal != null ? String(store.goal) : '')
  const [saving, setSaving] = useState(false)

  const area = AREAS[step].id
  const num = (t: string) => Number(t.replace(',', '.'))
  const foodOk = num(kcal) >= 500 && num(kcal) <= 10000 && num(protein) > 0 && num(protein) <= 1000
  const kgOk = goalKg.trim() === '' || (num(goalKg) >= 20 && num(goalKg) <= 400)

  async function finish(skip: Set<Area>) {
    setSaving(true)
    const tasks: Task[] = []
    let order = Math.max(0, ...store.allTasks.map((t) => t.sort_order))
    const existing = (c: Category) => store.allTasks.filter((t) => t.category === c)
    const add = (category: Category, title: string, extra: Partial<Task> = {}) => {
      // Running setup again doesn't add what you already have.
      if (existing(category).some((t) => sameTitle(t.title, title))) return
      tasks.push({
        id: `custom_${crypto.randomUUID().slice(0, 8)}`, category, title, details: '', duration_min: null, days_mask: ALL_DAYS,
        time_minutes: null, videos: null, steps: null, start_date: null, end_date: null, sort_order: ++order, archived: false, ...extra,
      })
    }
    // Water and steps have one item each: reuse it so a new goal just renames it.
    const replace = (category: Category, title: string) => {
      const t = existing(category)[0]
      if (!t) return add(category, title)
      if (t.title !== title) tasks.push({ ...t, title })
    }

    if (!skip.has('WATER')) replace('WATER', `Drink ${water} L of water`)
    for (const c of ['MEDS', 'BEAUTY', 'WORKOUT'] as const) {
      if (skip.has(c)) continue
      for (const title of picks[c]) add(c, title, STARTERS[c].find((s) => s.title === title)?.extra)
      for (const title of own[c]) add(c, title)
    }
    if (!skip.has('WALK')) replace('WALK', `Walk ${steps.toLocaleString('en-US')} steps`)
    // Weekly weigh-ins on Monday (bit 0).
    if (!skip.has('WEIGHT')) add('WEIGH', 'Weigh yourself', { days_mask: weighWeekly ? 1 : ALL_DAYS })

    const o: Picked = {
      tasks, hidden: [...skip],
      ...(!skip.has('FOOD') && { food: { kcal: Math.round(num(kcal)), protein: Math.round(num(protein) * 10) / 10 } }),
      ...(!skip.has('WATER') && { waterGoal: water }),
      ...(!skip.has('WEIGHT') && { goalKg: goalKg.trim() ? num(goalKg) : null }),
    }
    await store.finishOnboarding(o)
    setSaving(false)
    onDone()
  }

  function next(skip: boolean) {
    const s = new Set(skipped)
    if (skip) s.add(area); else s.delete(area)
    setSkipped(s)
    if (step === AREAS.length - 1) void finish(s)
    else setStep(step + 1)
  }

  const listStep = (c: 'MEDS' | 'BEAUTY' | 'WORKOUT') => (
    <PickList
      starters={STARTERS[c].map((s) => s.title)} own={own[c]} picked={picks[c]}
      onToggle={(title) => setPicks((p) => ({ ...p, [c]: p[c].includes(title) ? p[c].filter((x) => x !== title) : [...p[c], title] }))}
      onAdd={(title) => setOwn((p) => ({ ...p, [c]: p[c].some((x) => sameTitle(x, title)) ? p[c] : [...p[c], title] }))}
      onRemove={(title) => setOwn((p) => ({ ...p, [c]: p[c].filter((x) => x !== title) }))}
    />
  )

  const body: Record<Area, ReactNode> = {
    FOOD: (
      <div className="notify-body">
        <label className="time-row goal-row">Calories, at most
          <input inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} className={foodOk ? '' : 'invalid'} />
          <span>kcal</span>
        </label>
        <label className="time-row goal-row">Protein, at least
          <input inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} className={foodOk ? '' : 'invalid'} />
          <span>g</span>
        </label>
      </div>
    ),
    WATER: <Chips options={WATER_GOALS.map((l) => ({ id: l, label: `${l} L` }))} value={water} onPick={setWater} />,
    MEDS: listStep('MEDS'),
    BEAUTY: listStep('BEAUTY'),
    WORKOUT: listStep('WORKOUT'),
    WALK: <Chips options={STEP_GOALS.map((n) => ({ id: n, label: n.toLocaleString('en-US') }))} value={steps} onPick={setSteps} />,
    WEIGHT: (
      <div className="stack">
        <Chips options={[{ id: 1, label: 'Once a week' }, { id: 7, label: 'Every day' }]} value={weighWeekly ? 1 : 7} onPick={(v) => setWeighWeekly(v === 1)} />
        <div className="notify-body">
          <label className="time-row goal-row">Goal weight
            <input inputMode="decimal" value={goalKg} placeholder="optional" onChange={(e) => setGoalKg(e.target.value)} className={kgOk ? '' : 'invalid'} />
            <span>kg</span>
          </label>
        </div>
      </div>
    ),
    THANKS: null,
  }

  const isList = area === 'MEDS' || area === 'BEAUTY' || area === 'WORKOUT'
  const canGo = area === 'FOOD' ? foodOk : area === 'WEIGHT' ? kgOk : isList ? picks[area].length + own[area].length > 0 : true
  const primary = area === 'FOOD' ? 'Track food' : area === 'WEIGHT' ? 'Track weight' : area === 'THANKS' ? 'Yes, add it' : 'Continue'
  const { tone, icon } = areaStyle(area)
  const q = QUESTION[area]

  return (
    <div className="onboarding">
      <div className="row onboarding-top">
        {step > 0
          ? <button className="icon-btn" aria-label="Back" onClick={() => setStep(step - 1)}><Icon name="chevron-left" /></button>
          : <span className="icon-btn" />}
        <div className="progress grow" role="progressbar" aria-label="Setup" aria-valuemin={1} aria-valuemax={AREAS.length} aria-valuenow={step + 1}>
          <span style={{ width: `${((step + 1) / AREAS.length) * 100}%` }} />
        </div>
        <span className="muted small onboarding-count">{step + 1} of {AREAS.length}</span>
      </div>

      <section key={area} className={`section tone-${tone} fade`}>
        <div className="section-head">
          <Badge name={icon} />
          <div>
            <h2>{q.title}</h2>
            <div className="sub">{q.sub}</div>
          </div>
        </div>
        {body[area]}
      </section>

      <div className="onboarding-actions stack">
        <button className="btn-primary" disabled={!canGo || saving} onClick={() => next(false)}>
          {saving ? 'Saving…' : primary}
        </button>
        <button className="btn btn-white" disabled={saving} onClick={() => next(true)}>{q.skip}</button>
        <p className="muted small center">You can change all of this later in Settings.</p>
      </div>
    </div>
  )
}

function Chips<T extends number>({ options, value, onPick }: { options: { id: T; label: string }[]; value: T; onPick: (v: T) => void }) {
  return (
    <div className="chips onboarding-chips">
      {options.map((o) => (
        <button type="button" key={o.id} aria-pressed={value === o.id} className={value === o.id ? 'chip on' : 'chip'} onClick={() => onPick(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Starter chips to tap, plus your own items. */
function PickList({ starters, own, picked, onToggle, onAdd, onRemove }: {
  starters: string[]; own: string[]; picked: string[]
  onToggle: (t: string) => void; onAdd: (t: string) => void; onRemove: (t: string) => void
}) {
  const [text, setText] = useState('')
  const submit = () => { if (text.trim()) onAdd(text.trim()); setText('') }
  return (
    <div className="stack onboarding-chips">
      <div className="chips">
        {starters.map((t) => (
          <button type="button" key={t} aria-pressed={picked.includes(t)} className={picked.includes(t) ? 'chip on' : 'chip'} onClick={() => onToggle(t)}>
            {picked.includes(t) && <Icon name="tick" size={16} />}{t}
          </button>
        ))}
        {own.map((t) => (
          <button type="button" key={`own-${t}`} className="chip on" aria-label={`Remove ${t}`} onClick={() => onRemove(t)}>
            {t}<Icon name="x" size={16} />
          </button>
        ))}
      </div>
      <form className="row onboarding-add" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <input value={text} placeholder="Add your own" aria-label="Add your own" onChange={(e) => setText(e.target.value)} />
        <button className="icon-btn btn-white" aria-label="Add" disabled={!text.trim()}><Icon name="plus" /></button>
      </form>
    </div>
  )
}
