/** The app mark: a heart with a heartbeat line, next to the lowercase name. Colors come from the theme tokens. */
export function Logo({ size = 34 }: { size?: number }) {
  return (
    <span className="brand">
      <svg className="brand-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <path className="brand-heart" d="M32 57C28 53.6 6 38.6 6 21.8 6 13.6 12.4 7 20.4 7c5 0 9.2 2.6 11.6 6.6C34.4 9.6 38.6 7 43.6 7 51.6 7 58 13.6 58 21.8 58 38.6 36 53.6 32 57z" />
        <path className="brand-shine" d="M17 17.5c2.2-2.4 5.6-3 8.4-1.6" />
        <path className="brand-beat" d="M13 31h9l4-7 6 15 4.5-11 3 3H51" />
      </svg>
      <span className="brand-name">tend</span>
    </span>
  )
}
