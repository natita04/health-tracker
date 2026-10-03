import { useState } from 'react'
import { newSince, UPGRADES } from './defaults'
import { addDays, todayIso } from './dates'
import { tasksFor, type Store, type Thought } from './store'
import { WATER_PORTIONS, type Task, type Weight } from './types'

// Guest preview: same screens, made-up data kept in memory only. Nothing is read from or written to Supabase.

const SAMPLE_MEDS: Partial<Record<string, Partial<Task>>> = {
  med_eltroxin: { title: 'Vitamin D', details: 'With breakfast.', time_minutes: 8 * 60 },
  med_iron: { title: 'Probiotic', details: 'Before lunch.', time_minutes: 12 * 60 },
  med_lunch: { title: 'Omega 3', details: 'With lunch, fat in the meal helps absorption.', time_minutes: 13 * 60 + 30 },
  med_magnesium: { title: 'Magnesium', details: 'Evening, helps you wind down.', time_minutes: 21 * 60 },
}

function demoTasks(): Task[] {
  const map = new Map<string, Task>(newSince(0).map((t) => [t.id, { ...t, archived: false }]))
  for (const u of Object.values(UPGRADES)) {
    u.archive?.forEach((id) => { const t = map.get(id); if (t) t.archived = true })
    u.update?.forEach(({ id, set }) => { const t = map.get(id); if (t) Object.assign(t, set) })
  }
  // Show everything right away in the preview: no start/end dates, one steady walk goal.
  return [...map.values()]
    .filter((t) => !t.archived && !['walk_5000', 'walk_6500', 'walk_8000'].includes(t.id))
    .map((t) => ({ ...t, ...SAMPLE_MEDS[t.id], start_date: null, end_date: null, created_at: addDays(todayIso(), -30) }))
}

/** Deterministic "random" so the preview looks the same every time. */
const pseudo = (n: number) => { const x = Math.sin(n * 9301 + 49297) * 233280; return x - Math.floor(x) }

function demoData(tasks: Task[]) {
  const today = todayIso()
  const done: Record<string, Set<string>> = {}
  for (let i = 1; i <= 30; i++) {
    const d = addDays(today, -i)
    const s = new Set<string>()
    tasksFor(tasks, d).forEach((t, j) => {
      if (pseudo(i * 31 + j) < 0.75) {
        s.add(t.id)
        if (t.category === 'WATER') for (let k = 1; k <= WATER_PORTIONS; k++) s.add(`${t.id}#${k}`)
      }
    })
    done[d] = s
  }
  // A couple of things already done today.
  done[today] = new Set(tasksFor(tasks, today).filter((t) => t.category === 'MEDS').slice(0, 2).map((t) => t.id))
  ;['water_4l#1', 'water_4l#2', 'water_4l#3'].forEach((id) => done[today].add(id))

  const weights: Weight[] = []
  for (let i = 60; i >= 1; i -= 3) {
    weights.push({ date: addDays(today, -i), kg: Math.round((66.2 - (60 - i) * 0.045 + (pseudo(i) - 0.5) * 0.5) * 10) / 10 })
  }
  const t = (date: string, text: string, n: number): Thought => ({ id: `demo-${date}-${n}`, date, text, created_at: `${date}T20:0${n}:00Z` })
  const thoughts: Record<string, Thought[]> = {
    [today]: [t(today, 'A slow coffee in the sun', 1), t(today, 'A long call with an old friend', 2)],
    [addDays(today, -1)]: [t(addDays(today, -1), 'Finished the week strong', 1)],
  }
  return { done, weights, thoughts }
}

export function useDemoStore(onExit: () => void): Store {
  const [tasks, setTasks] = useState<Task[]>(demoTasks)
  const [initial] = useState(() => demoData(tasks))
  const [done, setDone] = useState(initial.done)
  const [weights, setWeights] = useState(initial.weights)
  const [thoughts, setThoughts] = useState(initial.thoughts)
  const [goal, setGoalState] = useState<number | null>(60)

  const setIds = (date: string, ids: string[], on: boolean) =>
    setDone((p) => {
      const s = new Set(p[date] ?? [])
      ids.forEach((id) => (on ? s.add(id) : s.delete(id)))
      return { ...p, [date]: s }
    })

  return {
    userId: 'guest', isGuest: true,
    signOut: async () => onExit(),
    tasks: tasks.filter((t) => !t.archived), done, weights, thoughts, thoughtsReady: true, goal,
    loading: false, error: null, clearError: () => {}, reload: async () => {},
    toggle: async (date, task, on) => setIds(date, [task.id], on),
    setWater: async (date, task, count) => {
      const all = Array.from({ length: WATER_PORTIONS }, (_, i) => `${task.id}#${i + 1}`)
      setIds(date, [...all, task.id], false)
      setIds(date, [...all.slice(0, count), ...(count >= WATER_PORTIONS ? [task.id] : [])], true)
    },
    addThought: async (date, text) =>
      setThoughts((p) => ({ ...p, [date]: [...(p[date] ?? []), { id: `g-${Date.now()}`, date, text, created_at: new Date().toISOString() }] })),
    removeThought: async (date, id) => setThoughts((p) => ({ ...p, [date]: (p[date] ?? []).filter((t) => t.id !== id) })),
    setGoal: async (kg) => setGoalState(kg),
    saveWeight: async (date, kg) =>
      setWeights((p) => [...p.filter((w) => w.date !== date), { date, kg }].sort((a, b) => a.date.localeCompare(b.date))),
    deleteWeight: async (date) => setWeights((p) => p.filter((w) => w.date !== date)),
    saveTask: async (task) => setTasks((p) => [...p.filter((t) => t.id !== task.id), task].sort((a, b) => a.sort_order - b.sort_order)),
    archiveTask: async (task) => setTasks((p) => p.map((t) => (t.id === task.id ? { ...t, archived: true } : t))),
    exportBackup: async () => alert("Backups aren't available in the guest preview."),
  }
}
