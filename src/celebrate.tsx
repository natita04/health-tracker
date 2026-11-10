import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Icon, type IconName } from './icons'

/**
 * Small celebrations for the moments worth a smile: water goal, a finished day,
 * three thank-yous, a lower weight. Call `celebrate(...)` from anywhere; <Celebrations />
 * (mounted once in the shell) shows the card and the confetti.
 */

type Kind = 'water' | 'morning' | 'evening' | 'done' | 'thanks' | 'weight' | 'low'
type Fx = 'confetti' | 'rise' | 'none'

interface Celebration {
  id: number
  kind: Kind
  title: string
  sub: string
  tone: string
  icon: IconName
  fx: Fx
  /** a bigger moment replaces a smaller one that is still showing */
  rank: number
}

const WATER_LINES = ['Your body says thanks.', 'Hydration hero.', 'Glowing from the inside.', 'Nicely done, sip by sip.']
const DONE_LINES = ['Every single thing, ticked.', 'You showed up for yourself today.', 'Rest easy, you earned it.', 'That is a full day.']
const MORNING_LINES = ['What a start to the day.', 'Morning handled. The rest is a bonus.', 'Off to a flying start.', 'Look at you, up and done.']
const EVENING_LINES = ['Evening wrapped up. Go unwind.', 'Day closed out, beautifully.', 'Time to switch off.', 'Sleep well, you earned it.']
const THANKS_LINES = ['Gratitude is a muscle. Look at you.', 'Three good things, noticed.', 'A little more light in the day.', 'Lovely. Keep noticing.']
const WEIGHT_LINES = ['Small steps add up.', 'Quietly doing the work.', 'Trending the right way.']
const LOW_LINES = ['Your lowest yet.', 'A new low, well earned.']

const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)]

let listener: ((c: Celebration) => void) | null = null
let seq = 0

const KEY = 'tend:celebrated:'
const seen = (k: string) => { try { return localStorage.getItem(KEY + k) !== null } catch { return false } }
const mark = (k: string) => { try { localStorage.setItem(KEY + k, '1') } catch { /* private mode: it may repeat, harmless */ } }

/** Each moment celebrates once (per day / per value), so ticking and un-ticking doesn't replay it. */
function fire(key: string, c: Omit<Celebration, 'id'>) {
  if (seen(key)) return
  mark(key)
  try { navigator.vibrate?.(c.rank >= 3 ? [30, 40, 30, 40, 60] : [20, 30, 20]) } catch { /* not supported */ }
  listener?.({ ...c, id: ++seq })
}

const litres = (n: number) => `${Number(n.toFixed(1))} L`

export const celebrateWater = (date: string, goalL: number) =>
  fire(`water:${date}`, { kind: 'water', title: `${litres(goalL)} of water`, sub: pick(WATER_LINES), tone: 'sky', icon: 'droplet', fx: 'rise', rank: 1 })

export const celebrateMorning = (date: string) =>
  fire(`morning:${date}`, { kind: 'morning', title: 'Morning done', sub: pick(MORNING_LINES), tone: 'peach', icon: 'sparkle', fx: 'confetti', rank: 2 })

export const celebrateEvening = (date: string) =>
  fire(`evening:${date}`, { kind: 'evening', title: 'Evening done', sub: pick(EVENING_LINES), tone: 'lilac', icon: 'sparkle', fx: 'confetti', rank: 2 })

export const celebrateDone = (date: string) =>
  fire(`done:${date}`, { kind: 'done', title: 'Perfect day', sub: pick(DONE_LINES), tone: 'butter', icon: 'check-circle', fx: 'confetti', rank: 3 })

export const celebrateThanks = (date: string) =>
  fire(`thanks:${date}`, { kind: 'thanks', title: 'Three thank-yous', sub: pick(THANKS_LINES), tone: 'rose', icon: 'heart', fx: 'rise', rank: 2 })

/** `lost` is kg since the previous weigh-in; `newLow` when it is lower than every earlier weight. */
export const celebrateWeight = (date: string, kg: number, lost: number, newLow: boolean) =>
  fire(`weight:${date}:${kg}`, {
    kind: newLow ? 'low' : 'weight',
    title: `Down ${Number(lost.toFixed(1))} kg`,
    sub: pick(newLow ? LOW_LINES : WEIGHT_LINES),
    tone: 'lilac', icon: 'scale', fx: newLow ? 'confetti' : 'rise', rank: 2,
  })

/** Runs `onRise` when `on` turns true while `key` stays the same (a new day or screen load never fires). */
export function useRise(on: boolean, key: string, onRise: () => void) {
  const prev = useRef({ key, on })
  useEffect(() => {
    if (prev.current.key === key && !prev.current.on && on) onRise()
    prev.current = { key, on }
  })
}

const COLORS = ['--sage-accent', '--sky-accent', '--rose-accent', '--butter-accent', '--lilac-accent', '--peach-accent']
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const rand = (a: number, b: number) => a + Math.random() * (b - a)

export function Celebrations() {
  const [c, setC] = useState<Celebration | null>(null)
  const [pieces, setPieces] = useState<CSSProperties[]>([])
  const current = useRef<Celebration | null>(null)

  useEffect(() => {
    listener = (next) => {
      if (current.current && current.current.rank > next.rank) return
      current.current = next
      setC(next)
      const n = next.fx === 'confetti' ? (next.rank >= 3 ? 140 : 100) : next.fx === 'rise' ? 9 : 0
      setPieces(reduced() ? [] : Array.from({ length: n }, (_, i) => next.fx === 'confetti'
        ? {
          left: `${rand(0, 100)}%`, '--dx': `${rand(-60, 60)}px`, '--rot': `${rand(-720, 720)}deg`,
          '--delay': `${rand(0, 900)}ms`, '--dur': `${rand(1800, 3000)}ms`,
          background: `var(${COLORS[i % COLORS.length]})`, width: rand(7, 12), height: rand(10, 18),
        } as CSSProperties
        : {
          '--dx': `${rand(-90, 90)}px`, '--delay': `${i * 90}ms`, left: `${rand(30, 70)}%`,
        } as CSSProperties))
    }
    return () => { listener = null }
  }, [])

  useEffect(() => {
    if (!c) return
    const t = setTimeout(() => { current.current = null; setC(null) }, c.rank >= 3 ? 5500 : 4200)
    return () => clearTimeout(t)
  }, [c])

  const close = () => { current.current = null; setC(null) }

  return (
    <div className="cel" aria-live="polite">
      {c && (
        <div key={c.id}>
          <div className="cel-fx" aria-hidden="true">
            {c.fx === 'confetti' && pieces.map((s, i) => <span key={i} className="cel-piece" style={s} />)}
            {c.fx === 'rise' && pieces.map((s, i) => (
              <span key={i} className={`cel-rise tone-${c.tone}`} style={s}><Icon name={c.icon} size={22} /></span>
            ))}
          </div>
          <button className={`cel-card tone-${c.tone}`} onClick={close}>
            <span className="cel-icon"><Icon name={c.icon} size={26} /></span>
            <span className="cel-text">
              <strong>{c.title}</strong>
              <span>{c.sub}</span>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
