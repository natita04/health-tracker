import { useState, type ReactNode } from 'react'
import type { Store } from '../store'
import { fmt, todayIso } from '../dates'
import { Badge, Icon } from '../icons'
import { KCAL_GOAL, PROTEIN_GOAL, type FoodEntry, type FoodInput } from '../types'

const SAVED_SHOWN = 5

/** Protein to one decimal, without a trailing ".0". */
const g1 = (n: number) => String(Math.round(n * 10) / 10)
const num = (n: number) => Math.round(n).toLocaleString('en-US')
const meta = (f: FoodInput) => `${Math.round(f.kcal)} kcal · ${g1(f.protein)} g protein`

/** What the confirm sheet is editing: a new meal (from an estimate or typed in) or one already logged. */
interface Draft {
  entry?: FoodEntry
  name: string
  kcal: string
  protein: string
  items?: FoodInput[]
  note?: string
}

/** Text in a number field -> number, or null if it isn't one (commas count as decimal points). */
const parseNum = (t: string, max: number) => {
  const n = Number(t.replace(',', '.'))
  return t.trim() !== '' && n >= 0 && n <= max ? n : null
}

export default function Food({ store }: { store: Store }) {
  const today = todayIso()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<FoodEntry | null>(null)

  const entries = store.food.filter((f) => f.date === today)
  const kcal = Math.round(entries.reduce((s, f) => s + f.kcal, 0))
  const protein = Math.round(entries.reduce((s, f) => s + f.protein, 0) * 10) / 10

  return (
    <>
      <header className="screen-head">
        <div>
          <div className="eyebrow">{fmt(today, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
          <h1>Food</h1>
        </div>
      </header>

      <section className="hero food-hero" aria-label="Today's totals">
        <Meter label="Calories" value={kcal} goal={KCAL_GOAL} unit="kcal" tone="peach" overIsBad />
        <Meter label="Protein" value={protein} goal={PROTEIN_GOAL} unit="g" tone="sage" />
      </section>

      {!store.foodReady && (
        <p className="banner small">The food log can't be saved yet: the database needs its one-time update (the SQL from setup).</p>
      )}

      <button className="btn-primary" onClick={() => setAdding(true)} disabled={!store.foodReady}>
        <Icon name="plus" />Add food
      </button>

      <section className="section tone-sage">
        <div className="section-head">
          <Badge name="apple" />
          <div>
            <h2>Eaten today</h2>
            {entries.length > 0 && <div className="sub">Tap to fix the numbers</div>}
          </div>
          <span className="counter">{entries.length}</span>
        </div>
        {entries.length === 0 ? (
          <p className="empty-line">Nothing logged yet today.</p>
        ) : (
          entries.map((f) => (
            <div key={f.id} className="food-row">
              <button className="food-body food-edit" onClick={() => setEditing(f)}>
                <span className="food-name" dir="auto">{f.name}</span>
                <span className="food-meta">{meta(f)}</span>
              </button>
              <button className="icon-btn" aria-label={`Remove ${f.name}`} onClick={() => void store.removeFood(f.id)}>
                <Icon name="x" />
              </button>
            </div>
          ))
        )}
      </section>

      {adding && <AddSheet store={store} date={today} onClose={() => setAdding(false)} />}
      {editing && (
        <Sheet label="Edit meal" onClose={() => setEditing(null)}>
          <FoodForm
            draft={{ entry: editing, name: editing.name, kcal: String(editing.kcal), protein: g1(editing.protein) }}
            onCancel={() => setEditing(null)}
            onRemove={() => { void store.removeFood(editing.id); setEditing(null) }}
            onSave={(f) => { void store.updateFood({ ...editing, ...f }); setEditing(null) }}
          />
        </Sheet>
      )}
    </>
  )
}

function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog stack" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

/** Everything about adding food: type and estimate, enter numbers, or pick from My meals. */
function AddSheet({ store, date, onClose }: { store: Store; date: string; onClose: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [showAll, setShowAll] = useState(false)
  /** names of saved meals added while the sheet is open, to show a tick */
  const [added, setAdded] = useState<Set<string>>(new Set())

  // Most eaten first: how many times each name was logged in the loaded history (last 120 days),
  // then the most recently used. Typing narrows the list down.
  // Counted once when the sheet opens, so a row doesn't jump while you tap +.
  const [uses] = useState(() => {
    const m = new Map<string, number>()
    for (const f of store.food) m.set(f.name, (m.get(f.name) ?? 0) + 1)
    return m
  })
  const ranked = [...store.savedFoods].sort((a, b) =>
    (uses.get(b.name) ?? 0) - (uses.get(a.name) ?? 0) || b.last_used.localeCompare(a.last_used))
  const q = text.trim().toLowerCase()
  const matches = q ? ranked.filter((s) => s.name.toLowerCase().includes(q)) : ranked
  const shown = showAll ? matches : matches.slice(0, SAVED_SHOWN)

  async function estimate() {
    const v = text.trim()
    if (!v || busy) return
    setBusy(true)
    try {
      const e = await store.estimateFood(v)
      setDraft({ name: e.name || v, kcal: String(Math.round(e.kcal)), protein: g1(e.protein), items: e.items })
    } catch (e) {
      const why = e instanceof Error && e.message ? ` (${e.message})` : ''
      setDraft({ name: v, kcal: '', protein: '', note: `Couldn't estimate this right now${why}, so fill in the numbers yourself.` })
    } finally {
      setBusy(false)
    }
  }

  if (draft?.items && draft.items.length > 1) {
    return (
      <Sheet label="Check the numbers" onClose={onClose}>
        <ItemsForm
          name={draft.name}
          items={draft.items}
          onBack={() => setDraft(null)}
          onSave={(list, remember) => {
            // One after another, so they show up in the order they were listed.
            void (async () => { for (const f of list) await store.addFood(date, f, remember) })()
            onClose()
          }}
        />
      </Sheet>
    )
  }

  if (draft) {
    return (
      <Sheet label="Add a meal" onClose={onClose}>
        <FoodForm
          draft={draft}
          onCancel={() => setDraft(null)}
          cancelLabel="Back"
          onSave={(f, remember) => { void store.addFood(date, f, remember); onClose() }}
        />
      </Sheet>
    )
  }

  return (
    <Sheet label="Add food" onClose={onClose}>
      <div className="row">
        <h2 className="grow">Add food</h2>
        <button className="icon-btn" aria-label="Close" onClick={onClose}><Icon name="x" /></button>
      </div>
      <form className="add-form sheet-form" onSubmit={(e) => { e.preventDefault(); void estimate() }}>
        <label className="sr-only" htmlFor="food-input">What did you eat?</label>
        <input id="food-input" dir="auto" value={text} onChange={(e) => { setText(e.target.value); setShowAll(false) }}
          placeholder="What did you eat?" maxLength={300} enterKeyHint="send" autoComplete="off" autoFocus disabled={busy} />
        <button className="add-btn" aria-label="Estimate calories and protein" disabled={!q || busy}>
          {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="sparkle" />}
        </button>
      </form>
      <p className="muted small" role="status">
        {busy ? 'Estimating…' : 'Write it like you\'d say it, the sparkle estimates calories and protein.'}
      </p>
      <button className="text-btn manual-btn" onClick={() => setDraft({ name: text.trim(), kcal: '', protein: '' })}>
        Enter numbers myself
      </button>

      <div className="food-picker tone-peach">
        <div className="food-sub">My meals</div>
        {store.savedFoods.length === 0 ? (
          <p className="empty-line">Meals you add are kept here, so next time it's one tap.</p>
        ) : matches.length === 0 ? (
          <p className="empty-line">No saved meal matches. Tap the sparkle to estimate it.</p>
        ) : (
          <>
            {shown.map((s) => {
              const isAdded = added.has(s.name)
              return (
                <div key={s.id} className="food-row">
                  <span className="food-body">
                    <span className="food-name" dir="auto">{s.name}</span>
                    <span className="food-meta">{meta(s)}</span>
                  </span>
                  {showAll && (
                    <button className="icon-btn" aria-label={`Forget ${s.name}`}
                      onClick={() => { if (confirm('Remove this from My meals?')) void store.removeSavedFood(s.id) }}>
                      <Icon name="x" />
                    </button>
                  )}
                  <button className={`add-small ${isAdded ? 'is-added' : ''}`} aria-label={isAdded ? `${s.name} added` : `Add ${s.name}`}
                    onClick={() => {
                      void store.addFood(date, { name: s.name, kcal: s.kcal, protein: s.protein }, true)
                      setAdded((p) => new Set(p).add(s.name))
                    }}>
                    <Icon name={isAdded ? 'tick' : 'plus'} />
                  </button>
                </div>
              )
            })}
            {(matches.length > SAVED_SHOWN || showAll) && (
              <button className="text-btn more-btn" onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Show less' : `Show all ${matches.length} (or remove)`}
              </button>
            )}
          </>
        )}
      </div>
      {added.size > 0 && <button className="btn-primary" onClick={onClose}>Done</button>}
    </Sheet>
  )
}

function Meter({ label, value, goal, unit, tone, overIsBad }: {
  label: string; value: number; goal: number; unit: string; tone: string; overIsBad?: boolean
}) {
  const left = Math.round((goal - value) * 10) / 10
  const status = left > 0 ? `${left} ${unit} to go` : left === 0 || !overIsBad ? 'Goal reached' : `${-left} ${unit} over`
  return (
    <div className="meter">
      <div className="meter-top">
        <span className="meter-label">{label}</span>
        <span className={`meter-status ${left < 0 && overIsBad ? 'over' : ''}`}>{status}</span>
      </div>
      <div><span className="meter-num">{value}</span><span className="hero-suffix">/ {goal} {unit}</span></div>
      <div className={`bar tone-${tone}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={goal} aria-valuenow={value}>
        <span style={{ width: `${Math.min(100, (value / goal) * 100)}%` }} />
      </div>
    </div>
  )
}

function FoodForm({ draft, onCancel, cancelLabel = 'Cancel', onSave, onRemove }: {
  draft: Draft
  onCancel: () => void
  cancelLabel?: string
  onSave: (f: FoodInput, remember: boolean) => void
  onRemove?: () => void
}) {
  const [name, setName] = useState(draft.name)
  const [kcalText, setKcal] = useState(draft.kcal)
  const [proteinText, setProtein] = useState(draft.protein)
  const [remember, setRemember] = useState(true)
  const isNew = !draft.entry
  const kcal = Number(kcalText.replace(',', '.'))
  const protein = Number(proteinText.replace(',', '.'))
  const valid = name.trim() !== '' && kcalText.trim() !== '' && proteinText.trim() !== ''
    && kcal >= 0 && kcal <= 10000 && protein >= 0 && protein <= 1000

  return (
    <form className="stack"
      onSubmit={(e) => { e.preventDefault(); if (valid) onSave({ name: name.trim(), kcal: Math.round(kcal), protein: Math.round(protein * 10) / 10 }, remember) }}>
      <h2>{isNew ? (draft.note || !draft.kcal ? 'Add a meal' : 'Check the numbers') : 'Edit meal'}</h2>
      {draft.note && <p className="banner small">{draft.note}</p>}
      {isNew && draft.kcal && !draft.note && <p className="muted small">An estimate, so tweak anything that looks off.</p>}
      <label>What you ate
        <input dir="auto" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} autoFocus={!name} />
      </label>
      <div className="grid2">
        <label>Calories (kcal)
          <input inputMode="numeric" value={kcalText} onChange={(e) => setKcal(e.target.value)} placeholder="e.g. 350" autoFocus={Boolean(name) && !kcalText} />
        </label>
        <label>Protein (g)
          <input inputMode="decimal" value={proteinText} onChange={(e) => setProtein(e.target.value)} placeholder="e.g. 25" />
        </label>
      </div>
      {isNew && (
        <button type="button" className="remember" aria-pressed={remember} onClick={() => setRemember(!remember)}>
          <span className={`check ${remember ? 'on' : ''}`} aria-hidden="true">{remember && <Icon name="tick" size={16} strokeWidth={3} />}</span>
          Save to My meals
        </button>
      )}
      <div className="row end">
        {onRemove && <button type="button" className="btn btn-danger" onClick={onRemove}>Remove</button>}
        <span className="grow" />
        <button type="button" className="btn btn-muted" onClick={onCancel}>{cancelLabel}</button>
        <button className="btn btn-ink" disabled={!valid}>{isNew ? 'Add' : 'Save'}</button>
      </div>
    </form>
  )
}

interface ItemRow { key: number; name: string; kcal: string; protein: string }

/** A meal estimated as several foods: fix any item, then log it as one meal or item by item. */
function ItemsForm({ name: initialName, items, onBack, onSave }: {
  name: string
  items: FoodInput[]
  onBack: () => void
  onSave: (list: FoodInput[], remember: boolean) => void
}) {
  const [name, setName] = useState(initialName)
  const [rows, setRows] = useState<ItemRow[]>(() =>
    items.map((i, n) => ({ key: n, name: i.name, kcal: String(Math.round(i.kcal)), protein: g1(i.protein) })))
  const [separate, setSeparate] = useState(false)
  const [remember, setRemember] = useState(true)

  const parsed = rows.map((r) => ({ name: r.name.trim(), kcal: parseNum(r.kcal, 10000), protein: parseNum(r.protein, 1000) }))
  const rowValid = parsed.map((p) => p.name !== '' && p.kcal != null && p.protein != null)
  const totalKcal = Math.round(parsed.reduce((s, p) => s + (p.kcal ?? 0), 0))
  const totalProtein = Math.round(parsed.reduce((s, p) => s + (p.protein ?? 0), 0) * 10) / 10
  const valid = rows.length > 0 && rowValid.every(Boolean) && (separate || name.trim() !== '')

  const set = (key: number, patch: Partial<ItemRow>) => setRows((p) => p.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  function save() {
    if (!valid) return
    const list = parsed.map((p) => ({ name: p.name, kcal: Math.round(p.kcal!), protein: Math.round(p.protein! * 10) / 10 }))
    onSave(separate ? list : [{ name: name.trim(), kcal: totalKcal, protein: totalProtein }], remember)
  }

  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); save() }}>
      <h2>Check the numbers</h2>
      <p className="muted small">An estimate, so fix any item that looks off.</p>

      <div className="food-items-edit" aria-label="Items">
        {rows.map((r, i) => (
          <div key={r.key} className="item-edit">
            <div className="row item-edit-top">
              <label className="sr-only" htmlFor={`item-name-${r.key}`}>Item {i + 1}</label>
              <input id={`item-name-${r.key}`} dir="auto" value={r.name} maxLength={200} placeholder="Food"
                className={r.name.trim() ? '' : 'invalid'} onChange={(e) => set(r.key, { name: e.target.value })} />
              <button type="button" className="icon-btn" aria-label={`Remove ${r.name || 'item'}`}
                onClick={() => setRows((p) => p.filter((x) => x.key !== r.key))}>
                <Icon name="x" />
              </button>
            </div>
            <div className="item-edit-nums">
              <label className="unit-field">
                <span className="sr-only">Calories for {r.name}</span>
                <input inputMode="numeric" value={r.kcal} placeholder="0" className={parsed[i].kcal == null ? 'invalid' : ''}
                  onChange={(e) => set(r.key, { kcal: e.target.value })} />
                <span aria-hidden="true">kcal</span>
              </label>
              <label className="unit-field">
                <span className="sr-only">Protein for {r.name}</span>
                <input inputMode="decimal" value={r.protein} placeholder="0" className={parsed[i].protein == null ? 'invalid' : ''}
                  onChange={(e) => set(r.key, { protein: e.target.value })} />
                <span aria-hidden="true">g protein</span>
              </label>
            </div>
          </div>
        ))}
        <button type="button" className="text-btn add-item-btn"
          onClick={() => setRows((p) => [...p, { key: Math.max(-1, ...p.map((x) => x.key)) + 1, name: '', kcal: '', protein: '' }])}>
          + Add an item
        </button>
        <div className="items-total" aria-live="polite">
          <span className="grow">Total</span>
          <strong>{num(totalKcal)} kcal</strong>
          <strong>{g1(totalProtein)} g protein</strong>
        </div>
      </div>

      <div className="stack-tight">
        <span className="label">Add as</span>
        <div className="segmented segmented-2" role="group" aria-label="Add as">
          <button type="button" aria-pressed={!separate} onClick={() => setSeparate(false)}>One meal</button>
          <button type="button" aria-pressed={separate} onClick={() => setSeparate(true)}>Separate items</button>
        </div>
      </div>
      {!separate && (
        <label>Meal name
          <input dir="auto" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
        </label>
      )}

      <button type="button" className="remember" aria-pressed={remember} onClick={() => setRemember(!remember)}>
        <span className={`check ${remember ? 'on' : ''}`} aria-hidden="true">{remember && <Icon name="tick" size={16} strokeWidth={3} />}</span>
        {separate ? `Save each item to My meals` : 'Save to My meals'}
      </button>
      <div className="row end">
        <span className="grow" />
        <button type="button" className="btn btn-muted" onClick={onBack}>Back</button>
        <button className="btn btn-ink" disabled={!valid}>{separate ? `Add ${rows.length} items` : 'Add'}</button>
      </div>
    </form>
  )
}
