export type Category = 'WEIGH' | 'WALK' | 'WATER' | 'WORKOUT' | 'MEDS' | 'BEAUTY'

export const CATEGORIES: { id: Category; label: string; emoji: string }[] = [
  { id: 'WEIGH', label: 'Weigh-in', emoji: '⚖️' },
  { id: 'WALK', label: 'Walk', emoji: '🚶' },
  { id: 'WATER', label: 'Water', emoji: '💧' },
  { id: 'WORKOUT', label: 'Workout', emoji: '🏋️' },
  { id: 'MEDS', label: 'Meds & supplements', emoji: '💊' },
  { id: 'BEAUTY', label: 'Beauty', emoji: '💆' },
]

export const catInfo = (c: string) => CATEGORIES.find((x) => x.id === c) ?? CATEGORIES[CATEGORIES.length - 1]

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
  /** minutes after midnight */
  time_minutes: number | null
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
