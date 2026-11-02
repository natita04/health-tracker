import type { ReactNode } from 'react'
import { Badge, CAT_STYLE, Icon, type IconName } from '../icons'
import { APP_NAME } from '../brand'

// The public front page. The app itself (and the sign in form) is one tap away.

type Go = (mode: 'in' | 'up') => void

const FEATURES: { icon: IconName; tone: string; kicker: string; title: string; text: string; demo: 'habits' | 'food' | 'insights' | 'yours' }[] = [
  {
    icon: 'check-circle', tone: CAT_STYLE.WALK.tone, kicker: 'Habits', demo: 'habits',
    title: 'Your whole day on one screen',
    text: 'Water, supplements, skincare, workouts and steps, grouped into morning, afternoon and evening. One tap to tick each off.',
  },
  {
    icon: 'apple', tone: CAT_STYLE.FOOD.tone, kicker: 'Food', demo: 'food',
    title: 'Log a meal in seconds',
    text: 'Snap a photo, say it out loud or type "shakshuka and a slice of toast". Calories and protein are estimated for you, in any language.',
  },
  {
    icon: 'chart', tone: CAT_STYLE.WATER.tone, kicker: 'Insights', demo: 'insights',
    title: 'See what is actually working',
    text: 'Streaks, weekly averages and honest patterns from your own data, like the habit that slips every weekend.',
  },
  {
    icon: 'sliders', tone: CAT_STYLE.BEAUTY.tone, kicker: 'Only what you want', demo: 'yours',
    title: 'Track as little or as much as you like',
    text: 'Not into counting calories? Skip it. Every part can be turned off, and back on whenever you are ready.',
  },
]

const STEPS = [
  { n: 1, title: 'Create an account', text: 'An email and a password. That is it.' },
  { n: 2, title: 'Pick what you track', text: 'A one minute setup: food goals, water, supplements, beauty, workouts, steps.' },
  { n: 3, title: 'Tick off your day', text: 'Add it to your home screen and it opens like an app.' },
]

export default function Landing({ onAuth, onGuest }: { onAuth: Go; onGuest: () => void }) {
  return (
    <div className="landing">
      <header className="lp-nav">
        <span className="lp-brand"><span className="lp-logo"><Icon name="heart" size={20} /></span>{APP_NAME}</span>
        <button className="btn btn-white" onClick={() => onAuth('in')}>Log in</button>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-text">
          <span className="lp-pill">Habits · Food · Weight · Insights</span>
          <h1>Feel on top of your health, one small tick at a time.</h1>
          <p className="lp-lead">
            A calm daily tracker for the things that keep you well: water, supplements, skincare, workouts, steps,
            meals and weight. Set up in a minute, done in a few taps a day.
          </p>
          <div className="lp-ctas">
            <button className="btn btn-ink lp-cta" onClick={() => onAuth('up')}>Get started, it's free</button>
            <button className="btn btn-white lp-cta" onClick={onGuest}>Try the demo</button>
          </div>
          <p className="muted small">No credit card, no ads. The demo uses sample data and saves nothing.</p>
        </div>
        <PhoneMock />
      </section>

      <section className="lp-features" aria-label="Features">
        {FEATURES.map((f) => (
          <article key={f.kicker} className={`lp-feature tone-${f.tone}`}>
            <div className="lp-feature-text">
              <div className="row lp-kicker"><Badge name={f.icon} />{f.kicker}</div>
              <h2>{f.title}</h2>
              <p>{f.text}</p>
            </div>
            <div className="lp-demo" aria-hidden>{DEMOS[f.demo]}</div>
          </article>
        ))}
      </section>

      <section className="lp-steps" aria-labelledby="how">
        <h2 id="how">Up and running in a minute</h2>
        <ol>
          {STEPS.map((s) => (
            <li key={s.n}>
              <span className="lp-step-n">{s.n}</span>
              <div><h3>{s.title}</h3><p>{s.text}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="lp-final">
        <h2>Start with a clean slate today.</h2>
        <p>Your plan, your data, in your own private account.</p>
        <div className="lp-ctas">
          <button className="btn btn-white lp-cta" onClick={() => onAuth('up')}>Create your account</button>
          <button className="btn lp-cta lp-ghost" onClick={() => onAuth('in')}>I already have one</button>
        </div>
      </section>

      <footer className="lp-footer muted small">
        <span>{APP_NAME}</span>
        <span>Only you can see your data.</span>
      </footer>
    </div>
  )
}

/** A static picture of the Habits screen, drawn with the app's own colors. */
function PhoneMock() {
  return (
    <div className="lp-phone" aria-hidden>
      <div className="lp-screen">
        <div className="lp-screen-head">
          <span className="muted">Mon, Nov 2</span>
          <strong>Habits</strong>
        </div>
        <div className="lp-tiles">
          <div className={`lp-tile tone-${CAT_STYLE.WALK.tone}`}>
            <Badge name="steps" /><b>Walk</b><span>8,000 steps</span><i className="lp-check on"><Icon name="tick" size={14} /></i>
          </div>
          <div className={`lp-tile tone-${CAT_STYLE.WATER.tone}`}>
            <Badge name="droplet" /><b>Water</b><span><strong>2.5</strong> L</span>
            <div className="lp-meter"><span style={{ width: '62%' }} /></div>
          </div>
        </div>
        <MockSection tone={CAT_STYLE.MEDS.tone} icon="pill" title="Supplements" count="2/3"
          rows={[['Vitamin D', true], ['Omega 3', true], ['Magnesium', false]]} />
        <MockSection tone={CAT_STYLE.BEAUTY.tone} icon="sparkle" title="Beauty" count="1/2"
          rows={[['Morning skincare', true], ['Evening skincare', false]]} />
      </div>
    </div>
  )
}

function MockSection({ tone, icon, title, count, rows }: { tone: string; icon: IconName; title: string; count: string; rows: [string, boolean][] }) {
  return (
    <div className={`lp-msection tone-${tone}`}>
      <div className="row"><Badge name={icon} /><b className="grow">{title}</b><span className="lp-count">{count}</span></div>
      {rows.map(([t, on]) => (
        <div key={t} className={on ? 'lp-mrow done' : 'lp-mrow'}>
          <i className={on ? 'lp-check on' : 'lp-check'}>{on && <Icon name="tick" size={14} />}</i>{t}
        </div>
      ))}
    </div>
  )
}

const DEMOS: Record<'habits' | 'food' | 'insights' | 'yours', ReactNode> = {
  habits: (
    <div className="lp-stack">
      {[['sunrise', 'Morning', 'Vitamin D · Sunscreen'], ['sun', 'Afternoon', 'Walk 8,000 steps'], ['moon', 'Evening', 'Magnesium · Skincare']].map(([i, p, t]) => (
        <div key={p} className="lp-card row"><Icon name={i as IconName} /><div><b>{p}</b><span>{t}</span></div></div>
      ))}
    </div>
  ),
  food: (
    <div className="lp-stack">
      <div className="lp-card lp-input row"><Icon name="mic" /><span className="grow">shakshuka and a slice of toast</span><Icon name="sparkle" /></div>
      <div className="lp-card"><b>Shakshuka, 2 eggs + toast</b><div className="row lp-nums"><span><strong>380</strong> kcal</span><span><strong>18</strong> g protein</span></div></div>
      <div className="lp-meter lp-meter-food"><span style={{ width: '70%' }} /></div>
      <span className="lp-caption">1,240 of 1,800 kcal today</span>
    </div>
  ),
  insights: (
    <div className="lp-stack">
      <div className="lp-card row"><Icon name="droplet" /><span>Water: 2.9 L a day on average this week.</span></div>
      <div className="lp-card row"><Icon name="dumbbell" /><span>New record: 12 days in a row of workouts!</span></div>
      <div className="lp-card row"><Icon name="apple" /><span>Protein dips on weekends: 84 g vs 118 g.</span></div>
    </div>
  ),
  yours: (
    <div className="lp-stack">
      {([['Food', false], ['Water', true], ['Supplements', true], ['Steps', true]] as [string, boolean][]).map(([t, on]) => (
        <div key={t} className="lp-card row"><b className="grow">{t}</b><span className={on ? 'lp-switch on' : 'lp-switch'} /></div>
      ))}
    </div>
  ),
}
