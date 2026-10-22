import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { newSince, UPGRADES, VERSION } from './defaults'
import { addDays, isScheduled, todayIso } from './dates'
import { isReminder, KCAL_GOAL, PROTEIN_GOAL, WATER_PORTIONS, type FoodEntry, type FoodEstimate, type FoodGoals, type FoodIdea, type FoodInput, type FoodPhoto, type SavedFood, type Task, type Weight } from './types'

const HISTORY_DAYS = 120

/** Supabase returns at most 1000 rows per request, so page through. */
async function fetchAll<T>(make: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await make(from, from + 999)
    if (error) throw error
    out.push(...(data ?? []))
    if (!data || data.length < 1000) return out
  }
}

async function seedDefaults(userId: string) {
  const { data, error } = await supabase.from('user_settings').select('defaults_version').maybeSingle()
  if (error) throw error
  const have = data?.defaults_version ?? 0
  if (have >= VERSION) return
  const rows = newSince(have).map((t) => ({ ...t, user_id: userId }))
  const ins = await supabase.from('tasks').upsert(rows, { onConflict: 'user_id,id', ignoreDuplicates: true })
  if (ins.error) throw ins.error
  for (let v = have + 1; v <= VERSION; v++) {
    const u = UPGRADES[v]
    if (!u) continue
    if (u.archive?.length) {
      const r = await supabase.from('tasks').update({ archived: true }).in('id', u.archive)
      if (r.error) throw r.error
    }
    for (const { id, set } of u.update ?? []) {
      const r = await supabase.from('tasks').update(set).eq('id', id)
      if (r.error) throw r.error
    }
  }
  const up = await supabase.from('user_settings').upsert({ user_id: userId, defaults_version: VERSION })
  if (up.error) throw up.error
}

const FOOD_COLS = 'id,date,name,kcal,protein,created_at'
const SAVED_COLS = 'id,name,kcal,protein,last_used'
// numeric columns can arrive as strings
const toEntry = (r: FoodEntry): FoodEntry => ({ ...r, kcal: Number(r.kcal), protein: Number(r.protein) })
const toSaved = (r: SavedFood): SavedFood => ({ ...r, kcal: Number(r.kcal), protein: Number(r.protein) })

export interface Thought {
  id: string
  date: string
  text: string
  created_at: string
}

export type Store = ReturnType<typeof useStore>

export function useStore(userId: string) {
  const [tasks, setTasks] = useState<Task[]>([])
  /** date -> set of done task ids */
  const [done, setDone] = useState<Record<string, Set<string>>>({})
  const [weights, setWeights] = useState<Weight[]>([])
  const [loading, setLoading] = useState(true)
  /** date -> thank you thoughts, oldest first */
  const [thoughts, setThoughts] = useState<Record<string, Thought[]>>({})
  /** false until the thoughts table exists (see supabase/schema.sql) */
  const [thoughtsReady, setThoughtsReady] = useState(true)
  const [goal, setGoalState] = useState<number | null>(null)
  const [food, setFood] = useState<FoodEntry[]>([])
  const [savedFoods, setSavedFoods] = useState<SavedFood[]>([])
  /** false until the food tables exist (see supabase/schema.sql) */
  const [foodReady, setFoodReady] = useState(true)
  const [foodGoals, setFoodGoalsState] = useState<FoodGoals>({ kcal: KCAL_GOAL, protein: PROTEIN_GOAL })
  const [error, setError] = useState<string | null>(null)

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : (e as { message?: string })?.message ?? String(e))

  const load = useCallback(async () => {
    try {
      setLoading(true)
      await seedDefaults(userId)
      const since = addDays(todayIso(), -HISTORY_DAYS)
      const [t, c, w] = await Promise.all([
        fetchAll<Task>((a, b) => supabase.from('tasks').select('*').order('sort_order').range(a, b)),
        fetchAll<{ date: string; task_id: string }>((a, b) =>
          supabase.from('completions').select('date,task_id').gte('date', since).order('date').range(a, b)),
        fetchAll<Weight>((a, b) => supabase.from('weights').select('date,kg').order('date').range(a, b)),
      ])
      setTasks(t)
      const map: Record<string, Set<string>> = {}
      for (const r of c) (map[r.date] ??= new Set()).add(r.task_id)
      setDone(map)
      setWeights(w.map((x) => ({ date: x.date, kg: Number(x.kg) })).sort((a, b) => a.date.localeCompare(b.date)))
      setError(null)
      // Newer features: don't let a missing table/column break the rest of the app.
      try {
        const th = await fetchAll<Thought>((a, b) =>
          supabase.from('thoughts').select('id,date,text,created_at').gte('date', since).order('created_at').range(a, b))
        const tm: Record<string, Thought[]> = {}
        for (const r of th) (tm[r.date] ??= []).push(r)
        setThoughts(tm)
        setThoughtsReady(true)
      } catch {
        setThoughtsReady(false)
      }
      try {
        const [fe, sf] = await Promise.all([
          fetchAll<FoodEntry>((a, b) =>
            supabase.from('food_entries').select(FOOD_COLS).gte('date', since).order('created_at').range(a, b)),
          fetchAll<SavedFood>((a, b) =>
            supabase.from('saved_foods').select(SAVED_COLS).order('last_used', { ascending: false }).range(a, b)),
        ])
        setFood(fe.map(toEntry))
        setSavedFoods(sf.map(toSaved))
        setFoodReady(true)
      } catch {
        setFoodReady(false)
      }
      // Separate query: until the columns exist (see supabase/schema.sql) the defaults apply.
      const fg = await supabase.from('user_settings').select('kcal_goal,protein_goal').maybeSingle()
      if (!fg.error && fg.data) {
        setFoodGoalsState({
          kcal: fg.data.kcal_goal != null ? Number(fg.data.kcal_goal) : KCAL_GOAL,
          protein: fg.data.protein_goal != null ? Number(fg.data.protein_goal) : PROTEIN_GOAL,
        })
      }
      const g = await supabase.from('user_settings').select('goal_kg').maybeSingle()
      setGoalState(!g.error && g.data?.goal_kg != null ? Number(g.data.goal_kg) : null)
    } catch (e) {
      fail(e)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { void load() }, [load])

  const active = tasks.filter((t) => !t.archived)

  const setDoneLocal = (date: string, id: string, on: boolean) =>
    setDone((prev) => {
      const s = new Set(prev[date] ?? [])
      if (on) s.add(id); else s.delete(id)
      return { ...prev, [date]: s }
    })

  async function toggle(date: string, task: Task, on: boolean) {
    setDoneLocal(date, task.id, on) // optimistic, rolled back on error
    const res = on
      ? await supabase.from('completions').upsert({ user_id: userId, date, task_id: task.id, title_snapshot: task.title })
      : await supabase.from('completions').delete().match({ date, task_id: task.id })
    if (res.error) { setDoneLocal(date, task.id, !on); fail(res.error) }
  }

  /** Water portions are stored as completions "<task id>#1".."#8"; the task itself is done at 8. */
  async function setWater(date: string, task: Task, count: number) {
    const part = (n: number) => `${task.id}#${n}`
    const all = Array.from({ length: WATER_PORTIONS }, (_, i) => part(i + 1))
    const want = new Set(all.slice(0, count))
    if (count >= WATER_PORTIONS) want.add(task.id)
    const before = new Set(done[date] ?? [])
    setDone((prev) => {
      const s = new Set(prev[date] ?? [])
      for (const id of [...all, task.id]) { if (want.has(id)) s.add(id); else s.delete(id) }
      return { ...prev, [date]: s }
    })
    const add = [...want].filter((id) => !before.has(id))
    const remove = [...all, task.id].filter((id) => !want.has(id) && before.has(id))
    const r1 = add.length
      ? await supabase.from('completions').upsert(add.map((id) => ({ user_id: userId, date, task_id: id, title_snapshot: task.title })))
      : { error: null }
    const r2 = remove.length
      ? await supabase.from('completions').delete().eq('date', date).in('task_id', remove)
      : { error: null }
    if (r1.error || r2.error) { fail(r1.error ?? r2.error); void load() }
  }

  async function addThought(date: string, text: string) {
    const temp: Thought = { id: `temp-${Date.now()}`, date, text, created_at: new Date().toISOString() }
    setThoughts((p) => ({ ...p, [date]: [...(p[date] ?? []), temp] }))
    const { data, error } = await supabase.from('thoughts').insert({ user_id: userId, date, text }).select('id,date,text,created_at').single()
    if (error) {
      setThoughts((p) => ({ ...p, [date]: (p[date] ?? []).filter((t) => t.id !== temp.id) }))
      return fail(error)
    }
    setThoughts((p) => ({ ...p, [date]: (p[date] ?? []).map((t) => (t.id === temp.id ? data : t)) }))
  }

  async function removeThought(date: string, id: string) {
    const before = thoughts[date] ?? []
    setThoughts((p) => ({ ...p, [date]: (p[date] ?? []).filter((t) => t.id !== id) }))
    if (id.startsWith('temp-')) return
    const { error } = await supabase.from('thoughts').delete().eq('id', id)
    if (error) { setThoughts((p) => ({ ...p, [date]: before })); fail(error) }
  }

  async function setGoal(kg: number | null) {
    const { error } = await supabase.from('user_settings').upsert({ user_id: userId, goal_kg: kg })
    if (error) return fail(error)
    setGoalState(kg)
  }

  async function saveWeight(date: string, kg: number) {
    const res = await supabase.from('weights').upsert({ user_id: userId, date, kg })
    if (res.error) return fail(res.error)
    setWeights((prev) => [...prev.filter((w) => w.date !== date), { date, kg }].sort((a, b) => a.date.localeCompare(b.date)))
    // Logging a weight counts as that day's weigh-in.
    for (const t of active.filter((t) => t.category === 'WEIGH' && isScheduled(t, date))) await toggle(date, t, true)
  }

  async function deleteWeight(date: string) {
    const res = await supabase.from('weights').delete().eq('date', date)
    if (res.error) return fail(res.error)
    setWeights((prev) => prev.filter((w) => w.date !== date))
  }

  async function saveTask(task: Task) {
    const res = await supabase.from('tasks').upsert({ ...task, user_id: userId })
    if (res.error) return fail(res.error)
    setTasks((prev) => [...prev.filter((t) => t.id !== task.id), task].sort((a, b) => a.sort_order - b.sort_order))
  }

  /** Removing only archives, so past history keeps its name. */
  const archiveTask = (task: Task) => saveTask({ ...task, archived: true })

  /** Logs a meal; with `remember`, also keeps it in saved foods (newest first). */
  async function addFood(date: string, f: FoodInput, remember: boolean) {
    const temp: FoodEntry = { id: `temp-${crypto.randomUUID()}`, date, ...f, created_at: new Date().toISOString() }
    setFood((p) => [...p, temp])
    const { data, error } = await supabase.from('food_entries').insert({ user_id: userId, date, ...f }).select(FOOD_COLS).single()
    if (error) {
      setFood((p) => p.filter((x) => x.id !== temp.id))
      return fail(error)
    }
    setFood((p) => p.map((x) => (x.id === temp.id ? toEntry(data) : x)))
    if (!remember) return
    const r = await supabase.from('saved_foods')
      .upsert({ user_id: userId, ...f, last_used: new Date().toISOString() }, { onConflict: 'user_id,name' })
      .select(SAVED_COLS).single()
    if (r.error) return fail(r.error)
    setSavedFoods((p) => [toSaved(r.data), ...p.filter((x) => x.id !== r.data.id)])
  }

  async function updateFood(entry: FoodEntry) {
    const before = food
    setFood((p) => p.map((x) => (x.id === entry.id ? entry : x)))
    const { name, kcal, protein } = entry
    const { error } = await supabase.from('food_entries').update({ name, kcal, protein }).eq('id', entry.id)
    if (error) { setFood(before); fail(error) }
  }

  async function removeFood(id: string) {
    const before = food
    setFood((p) => p.filter((x) => x.id !== id))
    if (id.startsWith('temp-')) return
    const { error } = await supabase.from('food_entries').delete().eq('id', id)
    if (error) { setFood(before); fail(error) }
  }

  /** Changes a saved meal's defaults; meals already logged keep their numbers. */
  async function updateSavedFood(saved: SavedFood) {
    const before = savedFoods
    setSavedFoods((p) => p.map((x) => (x.id === saved.id ? saved : x)))
    const { name, kcal, protein } = saved
    const { error } = await supabase.from('saved_foods').update({ name, kcal, protein }).eq('id', saved.id)
    if (error) { setSavedFoods(before); fail(error) }
  }

  async function removeSavedFood(id: string) {
    const before = savedFoods
    setSavedFoods((p) => p.filter((x) => x.id !== id))
    const { error } = await supabase.from('saved_foods').delete().eq('id', id)
    if (error) { setSavedFoods(before); fail(error) }
  }

  async function setFoodGoals(g: FoodGoals) {
    const { error } = await supabase.from('user_settings').upsert({ user_id: userId, kcal_goal: g.kcal, protein_goal: g.protein })
    if (error) return fail(error)
    setFoodGoalsState(g)
  }

  /** Calls the food-estimate edge function; it answers errors as { error: "..." }, surfaced instead of a generic status. */
  async function callFood<T>(body: object): Promise<T> {
    const { data, error } = await supabase.functions.invoke('food-estimate', { body })
    if (error) {
      const res = await (error as { context?: Response }).context?.json?.().catch(() => null)
      throw new Error(res?.error ?? error.message)
    }
    return data as T
  }

  /** Free text and/or a photo -> calories and protein. Throws if the function isn't set up. */
  const estimateFood = (text: string, photo?: FoodPhoto) => callFood<FoodEstimate>({ text, photo })

  /** A few ideas that fit what's left of today's calories and protein. */
  const suggestFood = (kcalLeft: number, proteinLeft: number, meals: FoodInput[]) =>
    callFood<{ ideas: FoodIdea[] }>({ mode: 'ideas', kcalLeft, proteinLeft, meals }).then((r) => r.ideas)

  async function exportBackup() {
    const [t, c, w] = await Promise.all([
      fetchAll((a, b) => supabase.from('tasks').select('*').range(a, b)),
      fetchAll((a, b) => supabase.from('completions').select('*').range(a, b)),
      fetchAll((a, b) => supabase.from('weights').select('*').range(a, b)),
    ])
    const [fe, sf] = foodReady
      ? await Promise.all([
        fetchAll((a, b) => supabase.from('food_entries').select('*').range(a, b)),
        fetchAll((a, b) => supabase.from('saved_foods').select('*').range(a, b)),
      ])
      : [[], []]
    const blob = new Blob([JSON.stringify({
      exportedAt: new Date().toISOString(), tasks: t, completions: c, weights: w, food_entries: fe, saved_foods: sf,
    }, null, 2)],
      { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `health-backup-${todayIso()}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  return {
    userId, isGuest: false, signOut: async (): Promise<void> => { await supabase.auth.signOut() },
    tasks: active, done, weights, thoughts, thoughtsReady, goal, food, savedFoods, foodReady, foodGoals,
    loading, error, clearError: () => setError(null), reload: load,
    toggle, setWater, addThought, removeThought, setGoal, saveWeight, deleteWeight, saveTask, archiveTask, exportBackup,
    addFood, updateFood, removeFood, updateSavedFood, removeSavedFood, estimateFood, suggestFood, setFoodGoals,
  }
}

/** What's on the plan for a day. Reminders are left out: they only send a notification. */
export const tasksFor = (tasks: Task[], date: string) =>
  tasks
    .filter((t) => !isReminder(t) && isScheduled(t, date) && (!t.start_date || date >= t.start_date) && (!t.end_date || date <= t.end_date))
    .sort((a, b) => (a.time_minutes ?? -1) - (b.time_minutes ?? -1) || a.sort_order - b.sort_order)
