import { useState } from 'react'
import type { Store } from '../store'
import { fmt, todayIso } from '../dates'
import { Badge, Icon } from '../icons'
import { KCAL_GOAL, PROTEIN_GOAL, type FoodEntry, type FoodInput } from '../types'

const SAVED_SHOWN = 5

/** Protein to one decimal, without a trailing ".0". */
const g1 = (n: number) => String(Math.round(n * 10) / 10)
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

export default function Food({ store }: { store: Store }) {
  const today = todayIso()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [showAll, setShowAll] = useState(false)

  const entries = store.food.filter((f) => f.date === today)
  const kcal = Math.round(entries.reduce((s, f) => s + f.kcal, 0))
  const protein = Math.round(entries.reduce((s, f) => s + f.protein, 0) * 10) / 10

  // Typing narrows "My meals" down, so a meal you've had before is one tap away.
  const q = text.trim().toLowerCase()
  const matches = q ? store.savedFoods.filter((s) => s.name.toLowerCase().includes(q)) : store.savedFoods
  const shown = showAll ? matches : matches.slice(0, SAVED_SHOWN)

  async function estimate() {
    const v = text.trim()
    if (!v || busy) return
    setBusy(true)
    try {
      const e = await store.estimateFood(v)
      setDraft({ name: e.name || v, kcal: String(Math.round(e.kcal)), protein: g1(e.protein), items: e.items })
    } catch {
      setDraft({ name: v, kcal: '', protein: '', note: "Couldn't estimate this right now, so fill in the numbers yourself." })
    } finally {
      setBusy(false)
    }
  }

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

      <section className="section tone-peach">
        <div className="section-head">
          <Badge name="apple" />
          <div>
            <h2>Add food</h2>
            <div className="sub">Write what you ate, the numbers get estimated</div>
          </div>
        </div>
        <form className="add-form" onSubmit={(e) => { e.preventDefault(); void estimate() }}>
          <label className="sr-only" htmlFor="food-input">What did you eat?</label>
          <input id="food-input" dir="auto" value={text} onChange={(e) => { setText(e.target.value); setShowAll(false) }}
            placeholder="What did you eat?" maxLength={300} enterKeyHint="send" autoComplete="off" disabled={!store.foodReady || busy} />
          <button className="add-btn" aria-label="Estimate calories and protein" disabled={!q || !store.foodReady || busy}>
            {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="sparkle" />}
          </button>
        </form>
        {busy && <p className="empty-line" role="status">Estimating…</p>}
        <button className="text-btn manual-btn" disabled={!store.foodReady}
          onClick={() => setDraft({ name: text.trim(), kcal: '', protein: '' })}>
          Enter numbers myself
        </button>

        <div className="food-sub">My meals</div>
        {store.savedFoods.length === 0 ? (
          <p className="empty-line">Meals you add are kept here, so next time it's one tap.</p>
        ) : matches.length === 0 ? (
          <p className="empty-line">No saved meal matches. Tap the sparkle to estimate it.</p>
        ) : (
          <>
            {shown.map((s) => (
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
                <button className="add-small" aria-label={`Add ${s.name}`}
                  onClick={() => { void store.addFood(today, { name: s.name, kcal: s.kcal, protein: s.protein }, true); setText('') }}>
                  <Icon name="plus" />
                </button>
              </div>
            ))}
            {(matches.length > SAVED_SHOWN || showAll) && (
              <button className="text-btn more-btn" onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Show less' : `Show all ${matches.length} (or remove)`}
              </button>
            )}
          </>
        )}
      </section>

      <section className="section tone-sage">
        <div className="section-head">
          <Badge name="check-circle" />
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
              <button className="food-body food-edit"
                onClick={() => setDraft({ entry: f, name: f.name, kcal: String(f.kcal), protein: g1(f.protein) })}>
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

      {draft && (
        <FoodDialog
          draft={draft}
          onClose={() => setDraft(null)}
          onRemove={draft.entry ? () => { void store.removeFood(draft.entry!.id); setDraft(null) } : undefined}
          onSave={(f, remember) => {
            if (draft.entry) void store.updateFood({ ...draft.entry, ...f })
            else { void store.addFood(today, f, remember); setText('') }
            setDraft(null)
          }}
        />
      )}
    </>
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

function FoodDialog({ draft, onClose, onSave, onRemove }: {
  draft: Draft
  onClose: () => void
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
    <div className="overlay" onClick={onClose}>
      <form className="dialog stack" role="dialog" aria-modal="true" aria-label={isNew ? 'Check the numbers' : 'Edit meal'}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); if (valid) onSave({ name: name.trim(), kcal: Math.round(kcal), protein: Math.round(protein * 10) / 10 }, remember) }}>
        <h2>{isNew ? (draft.note || !draft.kcal ? 'Add a meal' : 'Check the numbers') : 'Edit meal'}</h2>
        {draft.note && <p className="banner small">{draft.note}</p>}
        {isNew && draft.kcal && !draft.note && <p className="muted small">An estimate, so tweak anything that looks off.</p>}
        <label>What you ate
          <input dir="auto" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} autoFocus={!name} />
        </label>
        {draft.items && draft.items.length > 1 && (
          <ul className="food-items" aria-label="Breakdown">
            {draft.items.map((i, n) => (
              <li key={n}><span dir="auto" className="grow">{i.name}</span><span className="muted">{meta(i)}</span></li>
            ))}
          </ul>
        )}
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
          <button type="button" className="btn btn-muted" onClick={onClose}>Cancel</button>
          <button className="btn btn-ink" disabled={!valid}>{isNew ? 'Add' : 'Save'}</button>
        </div>
      </form>
    </div>
  )
}
