export type Category = 'WEIGH' | 'WALK' | 'WATER' | 'WORKOUT' | 'MEDS' | 'BEAUTY' | 'CHORE'

export const CATEGORIES: { id: Category; label: string; emoji: string }[] = [
  { id: 'WEIGH', label: 'Weigh-in', emoji: '⚖️' },
  { id: 'WALK', label: 'Walk', emoji: '🚶' },
  { id: 'WATER', label: 'Water', emoji: '💧' },
  { id: 'WORKOUT', label: 'Workout', emoji: '🏋️' },
  { id: 'MEDS', label: 'Meds & supplements', emoji: '💊' },
  { id: 'BEAUTY', label: 'Beauty', emoji: '💆' },
  // Stored as CHORE in the database; shown as Reminders.
  { id: 'CHORE', label: 'Reminders', emoji: '🔔' },
]

/** Reminders never show in the app (Today, History, stats): they only exist to send a push notification. */
export const isReminder = (t: { category: string }) => t.category === 'CHORE'

/** Categories that are tracked in the app, i.e. everything but reminders. */
export const TRACKED = CATEGORIES.filter((c) => c.id !== 'CHORE')

export const catInfo = (c: string) => CATEGORIES.find((x) => x.id === c) ?? TRACKED[TRACKED.length - 1]

/** Water is tracked in 0.5 L portions; 8 portions = 4 L. */
export const WATER_PORTIONS = 8
export const WATER_PORTION_L = 0.5

export interface Task {
  id: string
  category: Category
  title: string
  details: string
  duration_min: number | null
  /** bit 0 = Monday ... bit 6 = Sunday */
  days_mask: number
  /** Every N days from start_date instead of on weekdays; days_mask is ignored when set. */
  every_days?: number | null
  /** minutes after midnight */
  time_minutes: number | null
  /** Rough timing when there's no exact time: morning, afternoon or evening. */
  day_part?: PartOfDay | null
  /** Video options to pick from. */
  videos: Video[] | null
  /** Exercise list; lines starting with "# " are section headings. */
  steps: string[] | null
  /** Only show from / until these days (YYYY-MM-DD), both optional. */
  start_date: string | null
  end_date: string | null
  sort_order: number
  archived: boolean
  created_at?: string
}

export interface Video {
  title: string
  url: string
}

export interface Weight {
  date: string
  kg: number
}

export const ALL_DAYS = 0b1111111

/** Default daily food targets; editable in the Food tab. */
export const KCAL_GOAL = 1800
export const PROTEIN_GOAL = 120

export interface FoodGoals {
  kcal: number
  /** grams */
  protein: number
}

export interface FoodEntry {
  id: string
  date: string
  name: string
  kcal: number
  /** grams */
  protein: number
  created_at: string
}

/** A meal remembered for one-tap reuse. */
export interface SavedFood {
  id: string
  name: string
  kcal: number
  protein: number
  last_used: string
}

export type FoodInput = Pick<FoodEntry, 'name' | 'kcal' | 'protein'>

/** What the estimate function returns for free text. */
export interface FoodEstimate extends FoodInput {
  items: FoodInput[]
}

/** A photo for the estimate: base64 without the data: prefix. */
export interface FoodPhoto {
  data: string
  media_type: 'image/jpeg'
}

/** An idea for closing the protein gap. */
export interface FoodIdea extends FoodInput {
  /** true when it's one of your saved meals */
  mine: boolean
}

export type PartOfDay = 'morning' | 'afternoon' | 'evening'

export const PARTS: { id: PartOfDay; label: string }[] = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
]

/** When in the day an item belongs: its part of day, else from its time (morning before 12:00, afternoon until 17:00). */
export const partOf = (t: Pick<Task, 'time_minutes' | 'day_part'>): PartOfDay | null =>
  t.day_part ?? (t.time_minutes == null ? null : t.time_minutes < 12 * 60 ? 'morning' : t.time_minutes < 17 * 60 ? 'afternoon' : 'evening')

/** Sort key: morning, afternoon, evening, then any time. */
export const partRank = (t: Pick<Task, 'time_minutes' | 'day_part'>) => {
  const p = partOf(t)
  return p ? PARTS.findIndex((x) => x.id === p) : PARTS.length
}

/** From when an entry was added: morning before 12:00, afternoon until 17:00, then evening. */
export const partOfDay = (iso: string): PartOfDay => {
  const h = new Date(iso).getHours()
  return h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'afternoon' : 'evening'
}
