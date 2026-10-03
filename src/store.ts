import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { newSince, UPGRADES, VERSION } from './defaults'
import { addDays, isOn, todayIso } from './dates'
import type { Task, Weight } from './types'

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

export type Store = ReturnType<typeof useStore>

export function useStore(userId: string) {
  const [tasks, setTasks] = useState<Task[]>([])
  /** date -> set of done task ids */
  const [done, setDone] = useState<Record<string, Set<string>>>({})
  const [weights, setWeights] = useState<Weight[]>([])
  const [loading, setLoading] = useState(true)
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
    tasks: active, done, weights, loading, error, clearError: () => setError(null), reload: load,
    toggle, saveWeight, deleteWeight, saveTask, archiveTask, exportBackup,
  }
}

export const tasksFor = (tasks: Task[], date: string) =>
  tasks
    .filter((t) => isOn(t.days_mask, date) && (!t.start_date || date >= t.start_date) && (!t.end_date || date <= t.end_date))
    .sort((a, b) => (a.time_minutes ?? -1) - (b.time_minutes ?? -1) || a.sort_order - b.sort_order)
