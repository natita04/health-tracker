// All dates are local calendar days as "YYYY-MM-DD" strings, never UTC, so "today" is your today.

export const pad = (n: number) => String(n).padStart(2, '0')

export const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const fromIso = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const todayIso = () => toIso(new Date())

export const addDays = (s: string, n: number) => {
  const d = fromIso(s)
  d.setDate(d.getDate() + n)
  return toIso(d)
}

/** Monday = 0 ... Sunday = 6, matching the days_mask bits. */
export const dayIndex = (s: string) => (fromIso(s).getDay() + 6) % 7

export const isOn = (mask: number, s: string) => (mask & (1 << dayIndex(s))) !== 0

/** Whole days from a to b (negative when b is earlier). */
export const daysBetween = (a: string, b: string) => Math.round((fromIso(b).getTime() - fromIso(a).getTime()) / 86_400_000)

/** Whether an item falls on a day: every N days counted from its start date, or else on its weekdays. */
export const isScheduled = (t: { days_mask: number; every_days?: number | null; start_date: string | null }, s: string) => {
  if (!t.every_days) return isOn(t.days_mask, s)
  const n = daysBetween(t.start_date ?? s, s)
  return n >= 0 && n % t.every_days === 0
}

export const formatTime = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`

export const parseTime = (t: string): number | null => {
  const m = /^\s*(\d{1,2})[:.](\d{2})\s*$/.exec(t)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  return h < 24 && min < 60 ? h * 60 + min : null
}

export const fmt = (s: string, opts: Intl.DateTimeFormatOptions) => fromIso(s).toLocaleDateString(undefined, opts)
