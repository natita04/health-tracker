import { Logo } from './Logo'

/** A beating heart, centered, while the app gets ready. */
export default function Loading() {
  return (
    <div className="loading" role="status" aria-live="polite">
      <Logo size={56} beat />
      <span className="loading-sub">Getting your day ready</span>
    </div>
  )
}
