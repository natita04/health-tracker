import type { Category } from './types'

// Line icons, 24x24, stroke-based (see redesign handoff, section 4).
const PATHS = {
  'check-circle': <><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /></>,
  scale: <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M8.5 10a3.5 3.5 0 0 1 7 0" /><path d="M12 10l1.5-1.5" /></>,
  chart: <><path d="M4 4v16h16" /><path d="M8 14l3-3 3 2 5-6" /></>,
  sliders: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
  dumbbell: <path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" />,
  pill: <><rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-45 12 12)" /><path d="M9.5 9.5l5 5" /></>,
  sparkle: <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M18 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" /></>,
  'chevron-left': <path d="M15 6l-6 6 6 6" />,
  'chevron-right': <path d="M9 6l6 6-6 6" />,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  tick: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  // Extra icons in the same style for categories the handoff didn't cover.
  droplet: <path d="M12 3.5s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  steps: <><path d="M8 3.5c1.7 0 2.5 1.8 2.5 4s-.8 4.5-2.5 4.5S5.5 9.7 5.5 7.5 6.3 3.5 8 3.5z" /><path d="M6 15h4.2v1.5a2.1 2.1 0 0 1-4.2 0z" /><path d="M16 8.5c1.7 0 2.5 1.8 2.5 4s-.8 4.5-2.5 4.5-2.5-2.3-2.5-4.5.8-4 2.5-4z" /><path d="M14 20h4.2v-.5" /></>,
  play: <path d="M8 5.5v13l10.5-6.5z" />,
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 20, strokeWidth, className = '' }: {
  name: IconName; size?: number; strokeWidth?: number; className?: string
}) {
  return (
    <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
      focusable="false" style={strokeWidth ? { strokeWidth } : undefined}>
      {PATHS[name]}
    </svg>
  )
}

/** Each category owns a pastel family and an icon. */
export const CAT_STYLE: Record<Category | 'THANKS', { tone: 'sky' | 'sage' | 'lilac' | 'peach' | 'butter'; icon: IconName }> = {
  WEIGH: { tone: 'sky', icon: 'scale' },
  WALK: { tone: 'sage', icon: 'steps' },
  WATER: { tone: 'sky', icon: 'droplet' },
  WORKOUT: { tone: 'sage', icon: 'dumbbell' },
  MEDS: { tone: 'lilac', icon: 'pill' },
  BEAUTY: { tone: 'peach', icon: 'sparkle' },
  THANKS: { tone: 'butter', icon: 'heart' },
}

export function Badge({ name }: { name: IconName }) {
  return <span className="badge"><Icon name={name} /></span>
}
