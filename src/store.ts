import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { newSince, UPGRADES, VERSION } from './defaults'
import { addDays, isOn, todayIso } from './dates'
import { WATER_PORTIONS, type Task, type Weight } from './types'

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
    for (const t of active.filter((t) => t.category === 'WEIGH' && isOn(t.days_mask, date))) await toggle(date, t, true)
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

  async function exportBackup() {
    const [t, c, w] = await Promise.all([
      fetchAll((a, b) => supabase.from('tasks').select('*').range(a, b)),
      fetchAll((a, b) => supabase.from('completions').select('*').range(a, b)),
      fetchAll((a, b) => supabase.from('weights').select('*').range(a, b)),
    ])
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), tasks: t, completions: c, weights: w }, null, 2)],
      { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `health-backup-${todayIso()}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  return {
    userId, isGuest: false, signOut: async (): Promise<void> => { await supabase.auth.signOut() },
    tasks: active, done, weights, thoughts, thoughtsReady, goal, loading, error, clearError: () => setError(null), reload: load,
    toggle, setWater, addThought, removeThought, setGoal, saveWeight, deleteWeight, saveTask, archiveTask, exportBackup,
  }
}

export const tasksFor = (tasks: Task[], date: string) =>
  tasks
    .filter((t) => isOn(t.days_mask, date) && (!t.start_date || date >= t.start_date) && (!t.end_date || date <= t.end_date))
    .sort((a, b) => (a.time_minutes ?? -1) - (b.time_minutes ?? -1) || a.sort_order - b.sort_order)
