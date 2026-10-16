import { tasksFor, type Store } from './store'
import { addDays, dayIndex, todayIso } from './dates'
import { TRACKED, WATER_PORTIONS, WATER_PORTION_L, type Category } from './types'
import type { IconName } from './icons'
import { CAT_STYLE } from './icons'

export interface DayStat { date: string; done: number; total: number }

/** The first day you used the app; earlier days don't count as misses. */
export function startDate(store: Store) {
  const today = todayIso()
  return store.tasks.reduce((m, t) => (t.created_at && t.created_at.slice(0, 10) < m ? t.created_at.slice(0, 10) : m), today)
}

export function dayStat(store: Store, date: string, cat?: Category): DayStat {
  const scheduled = tasksFor(store.tasks, date).filter((t) => !cat || t.category === cat)
  const done = store.done[date] ?? new Set<string>()
  return { date, done: scheduled.filter((t) => done.has(t.id)).length, total: scheduled.length }
}

/** Days from `from` to today, oldest first. */
export function daysSince(from: string) {
  const out: string[] = []
  for (let d = from; d <= todayIso(); d = addDays(d, 1)) out.push(d)
  return out
}

/**
 * Streaks = days in a row with everything in a category done. Days with nothing scheduled
 * are skipped, and today only counts once it's complete (an unfinished today never breaks it).
 */
export function streaks(store: Store, cat: Category) {
  const today = todayIso()
  let run = 0, best = 0
  for (const d of daysSince(startDate(store))) {
    const s = dayStat(store, d, cat)
    if (!s.total) continue
    if (s.done === s.total) { run++; best = Math.max(best, run) }
    else if (d !== today) run = 0
  }
  return { current: run, best }
}

function rate(store: Store, days: string[], cat?: Category, weekend?: boolean) {
  let done = 0, total = 0
  for (const d of days) {
    if (weekend !== undefined && (dayIndex(d) >= 5) !== weekend) continue
    const s = dayStat(store, d, cat)
    done += s.done; total += s.total
  }
  return { done, total, pct: total ? Math.round((done * 100) / total) : null }
}

export interface Insight { id: string; text: string; tone: string; icon: IconName }

/** A few plain-language observations from your own data, most interesting first. */
export function insights(store: Store): Insight[] {
  const today = todayIso()
  const start = startDate(store)
  const last30 = daysSince(start > addDays(today, -29) ? start : addDays(today, -29))
  // Leave today out of rates: it's still in progress.
  const past30 = last30.filter((d) => d < today)
  if (past30.length < 3) return []

  const cats = TRACKED.filter((c) => store.tasks.some((t) => t.category === c.id))
  const out: Insight[] = []
  const style = (c: Category) => ({ tone: CAT_STYLE[c].tone, icon: CAT_STYLE[c].icon })

  // New personal records.
  for (const c of cats) {
    const s = streaks(store, c.id)
    if (s.current >= 3 && s.current === s.best) {
      out.push({ id: `record-${c.id}`, text: `New record: ${s.current} days in a row of ${c.label.toLowerCase()}!`, ...style(c.id) })
    }
  }

  const rates = cats.map((c) => ({ c, r: rate(store, past30, c.id) })).filter((x) => x.r.total >= 5 && x.r.pct != null)
  const best = [...rates].sort((a, b) => b.r.pct! - a.r.pct!)[0]
  if (best && best.r.pct! >= 80) {
    out.push({ id: 'best', text: `${best.c.label}: ${best.r.pct}% this month. Rock solid.`, ...style(best.c.id) })
  }

  out.push(...foodInsights(store, past30))

  // Weekend dip.
  for (const c of cats) {
    const wk = rate(store, past30, c.id, false), we = rate(store, past30, c.id, true)
    if (wk.total >= 4 && we.total >= 2 && wk.pct! - we.pct! >= 20) {
      out.push({ id: `weekend-${c.id}`, text: `${c.label} slips on weekends: ${we.pct}% vs ${wk.pct}% on weekdays.`, ...style(c.id) })
      break
    }
  }

  // Most skipped single item.
  const items = store.tasks.map((t) => {
    let sched = 0, done = 0
    for (const d of past30) {
      if (!tasksFor([t], d).length) continue
      sched++
      if (store.done[d]?.has(t.id)) done++
    }
    return { t, sched, done }
  }).filter((x) => x.sched >= 5 && x.done / x.sched < 0.7).sort((a, b) => a.done / a.sched - b.done / b.sched)
  if (items[0]) {
    const { t, sched, done } = items[0]
    out.push({ id: 'skipped', text: `Most skipped: ${t.title} (done ${done} of ${sched} days). The one to give some love.`, ...style(t.category) })
  }

  // Water average over the last 7 full days.
  const water = store.tasks.find((t) => t.category === 'WATER')
  if (water) {
    const days = past30.slice(-7).filter((d) => tasksFor([water], d).length)
    if (days.length >= 3) {
      const litres = days.reduce((sum, d) => {
        let n = 0
        while (n < WATER_PORTIONS && store.done[d]?.has(`${water.id}#${n + 1}`)) n++
        return sum + n * WATER_PORTION_L
      }, 0) / days.length
      out.push({ id: 'water', text: `You've averaged ${litres.toFixed(1)} L of water a day this week.`, ...style('WATER') })
    }
  }

  // Weight over 30 days.
  const w = store.weights.filter((x) => x.date >= addDays(today, -30))
  if (w.length >= 2) {
    const diff = w[w.length - 1].kg - w[0].kg
    if (Math.abs(diff) >= 0.1) {
      out.push({ id: 'weight', text: `Weight: ${diff < 0 ? 'down' : 'up'} ${Math.abs(diff).toFixed(1)} kg over the last 30 days.`, ...style('WEIGH') })
    }
  }

  // Thank you thoughts this week.
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, -i))
  const thanks = week.reduce((n, d) => n + (store.thoughts[d]?.length ?? 0), 0)
  if (thanks > 0) out.push({ id: 'thanks', text: `${thanks} thank you thought${thanks === 1 ? '' : 's'} this week.`, ...CAT_STYLE.THANKS })

  return out.slice(0, 5)
}

/** Calories and protein per logged day. */
export function foodTotals(store: Store) {
  const t: Record<string, { kcal: number; protein: number }> = {}
  for (const f of store.food) {
    const d = (t[f.date] ??= { kcal: 0, protein: 0 })
    d.kcal += f.kcal
    d.protein += f.protein
  }
  return t
}

/** At most two food observations: a protein streak or weekend dip, and this week's calories. */
function foodInsights(store: Store, past30: string[]): Insight[] {
  const totals = foodTotals(store)
  const { kcal: kcalGoal, protein: proteinGoal } = store.foodGoals
  const logged = past30.filter((d) => totals[d])
  if (logged.length < 3) return []
  const out: Insight[] = []
  const food = CAT_STYLE.FOOD

  // Protein goal streak: full days in a row, counting back from yesterday.
  let run = 0
  for (let i = past30.length - 1; i >= 0 && (totals[past30[i]]?.protein ?? 0) >= proteinGoal; i--) run++
  const avg = (ds: string[], k: 'kcal' | 'protein') => ds.reduce((s, d) => s + totals[d][k], 0) / ds.length
  const wkend = logged.filter((d) => dayIndex(d) >= 5), wkday = logged.filter((d) => dayIndex(d) < 5)
  if (run >= 3) {
    out.push({ id: 'protein-run', text: `Protein goal hit ${run} days in a row!`, ...food })
  } else if (wkend.length >= 2 && wkday.length >= 3 && avg(wkday, 'protein') - avg(wkend, 'protein') >= 15) {
    out.push({
      id: 'protein-weekend', ...food,
      text: `Protein dips on weekends: ${Math.round(avg(wkend, 'protein'))} g vs ${Math.round(avg(wkday, 'protein'))} g on weekdays.`,
    })
  }

  // Calories, last 7 full days.
  const week = logged.slice(-7).filter((d) => d >= addDays(todayIso(), -7))
  if (week.length >= 3) {
    const k = Math.round(avg(week, 'kcal'))
    out.push({
      id: 'kcal-week', ...food,
      text: k <= kcalGoal
        ? `Calories this week: ${k.toLocaleString('en-US')} a day on average, within your ${kcalGoal.toLocaleString('en-US')}.`
        : `Calories this week: ${k.toLocaleString('en-US')} a day on average, ${(k - kcalGoal).toLocaleString('en-US')} over your goal.`,
    })
  }
  return out
}
