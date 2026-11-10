import { Logo } from './Logo'

/** A beating heart over a ghost of the Habits screen, so the page appears to fill in rather than jump. */
export default function Loading() {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="sr-only">Loading your day</span>
      <div className="loading-top" aria-hidden="true">
        <Logo size={44} beat />
        <span className="loading-sub">Getting your day ready</span>
      </div>
      <div className="ghost" aria-hidden="true">
        <div className="ghost-week">{Array.from({ length: 7 }, (_, i) => <span key={i} className="shimmer" />)}</div>
        <div className="ghost-grid"><span className="shimmer" /><span className="shimmer" /></div>
        <span className="shimmer ghost-row" />
        <span className="shimmer ghost-row" />
        <span className="shimmer ghost-row" />
      </div>
    </div>
  )
}
