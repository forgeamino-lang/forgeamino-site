// Decorative Halloween artwork for the holiday carousel slide and the
// site-wide sale banner. Pure SVG, aria-hidden, no external assets.

export function HalloweenSlideArt() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1200 300"
      preserveAspectRatio="xMaxYMid slice"
    >
      <defs>
        <radialGradient id="ha-moon" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#fff4d6" />
          <stop offset="70%" stopColor="#ffd27a" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.9" />
        </radialGradient>
        <radialGradient id="ha-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffb347" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#ffb347" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ha-pumpkin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff9a2e" />
          <stop offset="100%" stopColor="#e2620d" />
        </linearGradient>
      </defs>

      {/* moon + glow */}
      <circle cx="1010" cy="110" r="150" fill="url(#ha-glow)" />
      <circle cx="1010" cy="110" r="72" fill="url(#ha-moon)" />
      <circle cx="985" cy="95" r="9" fill="#f2c063" opacity="0.6" />
      <circle cx="1030" cy="128" r="6" fill="#f2c063" opacity="0.5" />

      {/* bats */}
      <g fill="#120a1f">
        <path d="M880 70c8-10 18-12 24-6 4-6 8-6 10 0 6-6 16-4 24 6-10-2-16 2-20 8-3-4-6-4-8 0-3-4-6-4-8 0-4-6-12-10-22-8z" />
        <path transform="translate(150 60) scale(0.7)" d="M880 70c8-10 18-12 24-6 4-6 8-6 10 0 6-6 16-4 24 6-10-2-16 2-20 8-3-4-6-4-8 0-3-4-6-4-8 0-4-6-12-10-22-8z" />
        <path transform="translate(-40 110) scale(0.55)" d="M880 70c8-10 18-12 24-6 4-6 8-6 10 0 6-6 16-4 24 6-10-2-16 2-20 8-3-4-6-4-8 0-3-4-6-4-8 0-4-6-12-10-22-8z" />
      </g>

      {/* spider web, top-left corner */}
      <g stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1.2" fill="none">
        <path d="M0 0 L140 0 M0 0 L120 60 M0 0 L70 110 M0 0 L0 140" />
        <path d="M35 0 Q32 15 30 15 Q18 26 18 28 Q12 34 0 35" />
        <path d="M75 0 Q68 30 64 32 Q40 56 38 60 Q22 70 0 75" />
        <path d="M115 0 Q104 48 98 50 Q62 86 58 92 Q34 106 0 115" />
      </g>

      {/* ground + pumpkins */}
      <path d="M760 300 Q900 250 1200 262 L1200 300 Z" fill="#0b0613" opacity="0.85" />
      <g transform="translate(1085 238)">
        <ellipse cx="0" cy="22" rx="46" ry="34" fill="url(#ha-pumpkin)" />
        <path d="M-14 -10 q14 -6 28 0" stroke="#b9500b" strokeWidth="3" fill="none" />
        <path d="M0 -12 q6 -14 16 -16" stroke="#3f6b22" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M-22 14 l9 -9 l9 9 z M5 14 l9 -9 l9 9 z" fill="#3a1602" />
        <path d="M-22 32 q22 16 44 0 l-6 4 l-5 -5 l-5 6 l-6 -6 l-5 6 l-5 -5 z" fill="#3a1602" />
      </g>
      <g transform="translate(990 262) scale(0.6)">
        <ellipse cx="0" cy="22" rx="46" ry="34" fill="url(#ha-pumpkin)" />
        <path d="M0 -12 q6 -14 16 -16" stroke="#3f6b22" strokeWidth="5" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  )
}

// Small inline icons for the slim banner.
export function BatIcon({ className = '' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 60 20" className={className} fill="currentColor">
      <path d="M0 10c8-10 18-12 24-6 2-4 4-5 6-5s4 1 6 5c6-6 16-4 24 6-10-2-16 2-20 8-3-4-6-4-8 0-1-2-1.5-3-2-3s-1 1-2 3c-2-4-5-4-8 0C16 12 10 8 0 10z" />
    </svg>
  )
}

export function PumpkinIcon({ className = '' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 40 36" className={className}>
      <ellipse cx="20" cy="22" rx="18" ry="13" fill="#ff8a1f" />
      <path d="M20 9 q2 -6 7 -7" stroke="#4d7c2a" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M11 19 l4 -4 l4 4 z M21 19 l4 -4 l4 4 z" fill="#2a1002" />
      <path d="M11 26 q9 6 18 0 l-3 2 l-2 -2 l-2 3 l-2 -3 l-2 3 l-2 -3 z" fill="#2a1002" />
    </svg>
  )
}
