'use client'

// "Harvest → Frost" artwork for the Black Friday → Cyber Monday sale
// (theme: 'harvest'): autumn leaves on the left of the banner turning into
// pixel snow on the right, a turkey peeking over the sale slide, and a
// Fri–Mon tracker that shifts from autumn colors to the cyber look.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { rememberPromo } from './useHolidayOffer'

export function HarvestBannerArt() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1440 50" preserveAspectRatio="none">
      <path className="[transform-box:fill-box] [transform-origin:center] motion-safe:animate-[harvest-drift_6s_ease-in-out_infinite]" d="M40 18l3 7 6-3-1 7 6 1-6 5 3 6-7-2-3 7-3-7-7 2 3-6-6-5 6-1-1-7 6 3z" fill="#e9a777" />
      <ellipse cx="150" cy="30" rx="9" ry="4" fill="#f0bc98" transform="rotate(-25 150 30)" />
      <path d="M260 8l2 5 4-2-1 5 4 1-4 3 2 4-5-1-2 5-2-5-5 1 2-4-4-3 4-1-1-5 4 2z" fill="#d9622b" opacity=".55" />
      <ellipse cx="360" cy="38" rx="7" ry="3" fill="#e9a777" transform="rotate(30 360 38)" />
      <rect x="1080" y="12" width="6" height="6" fill="#7fcbef" />
      <rect x="1160" y="30" width="4" height="4" fill="#4fc3f7" />
      <rect x="1240" y="8" width="6" height="6" fill="#a8dcf4" />
      <rect x="1320" y="26" width="8" height="8" fill="#4fc3f7" opacity=".6" />
      <rect x="1400" y="14" width="4" height="4" fill="#7fcbef" />
    </svg>
  )
}

export function TurkeyPeek({ className = '' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 120 66" className={`motion-safe:animate-[harvest-peek_5s_ease-in-out_infinite] ${className}`}>
      <path d="M60 60 L18 34 Q14 14 30 10 Z" fill="#d9622b" />
      <path d="M60 60 L34 12 Q46 -2 60 4 Z" fill="#ef8a3c" />
      <path d="M60 60 L60 4 Q76 -2 86 12 Z" fill="#e6772f" />
      <path d="M60 60 L86 12 Q104 14 102 34 Z" fill="#f2a65a" />
      <ellipse cx="60" cy="52" rx="22" ry="16" fill="#7a4a2a" />
      <circle cx="53" cy="48" r="5" fill="#fff" /><circle cx="67" cy="48" r="5" fill="#fff" />
      <circle cx="54" cy="49" r="2.4" fill="#0d1b2a" /><circle cx="66" cy="49" r="2.4" fill="#0d1b2a" />
      <path d="M57 54 L63 54 L60 59 Z" fill="#f5b83d" />
    </svg>
  )
}

const DAYS = [
  { short: 'FRI', name: 'Black Friday', look: 'autumn' },
  { short: 'SAT', name: 'Saturday', look: 'autumn' },
  { short: 'SUN', name: 'Sunday', look: 'frost' },
  { short: 'MON', name: 'Cyber Monday', look: 'cyber' },
]
const LOOK = {
  autumn: { box: 'bg-[#fbf3ea] border-[#f0d3bd]', today: 'border-[#d9622b]', top: 'text-[#a4502a]', name: 'text-[#7a3a1c]' },
  frost: { box: 'bg-[#eef8fd] border-[#c6e6f6]', today: 'border-[#0b84c6]', top: 'text-[#0b6fa6]', name: 'text-[#0b4f78]' },
  cyber: { box: 'bg-[#0b1a2e] border-[#0b1a2e] font-mono', today: 'border-[#4fc3f7]', top: 'text-[#4fc3f7]', name: 'text-[#e6f6ff]' },
}

// Which sale day it is (0 = Friday), counted from starts_at (12:01 am CST).
function saleDay(startsAt, now) {
  const s = new Date(startsAt || 0).getTime()
  if (!Number.isFinite(s) || now < s) return -1
  return Math.floor((now - s) / 864e5)
}

function DayTracker({ startsAt }) {
  const [today, setToday] = useState(-1) // set after mount: no SSR/clock mismatch
  useEffect(() => {
    const tick = () => setToday(saleDay(startsAt, Date.now()))
    tick()
    const t = setInterval(tick, 60000)
    return () => clearInterval(t)
  }, [startsAt])
  return (
    <ol className="grid grid-cols-4 gap-1.5 sm:gap-2" aria-label="Sale days">
      {DAYS.map((d, k) => {
        const L = LOOK[d.look]
        const isToday = k === today
        return (
          <li key={d.short} className={`rounded-lg px-2 sm:px-3 py-2 ${L.box} ${isToday ? `border-2 ${L.today}` : 'border'}`} aria-current={isToday ? 'date' : undefined}>
            <div className={`text-[9px] sm:text-[11px] tracking-[0.2em] ${L.top}`}>{d.short}{isToday ? ' · TODAY' : ''}</div>
            <div className={`text-[11px] sm:text-[13px] font-semibold leading-tight ${L.name}`}>{d.name}</div>
          </li>
        )
      })}
    </ol>
  )
}

const CT = 'America/Chicago'
function dateRange(startsAt, endsAt) {
  try {
    const s = new Date(startsAt), e = new Date(new Date(endsAt).getTime() - 1000)
    const m = d => d.toLocaleString('en-US', { month: 'short', timeZone: CT })
    const day = d => d.toLocaleString('en-US', { day: 'numeric', timeZone: CT })
    if (!startsAt || !endsAt) return null
    return m(s) === m(e) ? `${m(s)} ${day(s)} – ${day(e)}` : `${m(s)} ${day(s)} – ${m(e)} ${day(e)}`
  } catch { return null }
}
function endsLabel(endsAt) {
  if (!endsAt) return null
  const e = new Date(endsAt)
  const wd = e.toLocaleString('en-US', { weekday: 'short', timeZone: CT })
  const md = e.toLocaleString('en-US', { month: 'numeric', day: 'numeric', timeZone: CT })
  const tm = e.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: CT }).toLowerCase()
  return `Ends ${wd} ${md} · ${tm} CST`
}

// The whole sale slide (white card + ticket stub). Rendered by the carousel
// in place of the standard slide layout when tone === 'harvest'.
export function HarvestSlide({ s, active }) {
  const [copied, setCopied] = useState(false)
  const pctLabel = s.pct ? `${Math.round(s.pct * 100)}%` : null
  const range = dateRange(s.startsAt, s.endsAt)
  const href = s.code ? `${s.cta.href}${s.cta.href.includes('?') ? '&' : '?'}promo=${encodeURIComponent(s.code)}` : s.cta.href

  const onCopy = () => {
    rememberPromo(s.code)
    try { navigator.clipboard?.writeText(s.code) } catch {}
    setCopied(true)
  }

  return (
    <div className="grid md:grid-cols-[1.3fr_1fr] bg-white text-[#0d1b2a] h-full">
      <div className="px-6 sm:px-12 py-7 sm:py-9 flex flex-col justify-center gap-3 sm:gap-4">
        <p className="text-[11px] sm:text-[13px] tracking-[0.3em] uppercase text-[#0b84c6] font-semibold">
          {range ? `${range} · ` : ''}{s.eyebrow}
        </p>
        {pctLabel ? (
          <h2 className="flex items-baseline gap-3 sm:gap-4" aria-label={s.headline}>
            <span className="text-6xl sm:text-8xl font-extralight leading-[0.85] tracking-tighter text-[#0b84c6]">{pctLabel}</span>
            <span className="font-mono text-3xl sm:text-5xl font-bold tracking-wide">OFF</span>
          </h2>
        ) : (
          <h2 className="text-2xl sm:text-4xl font-black leading-tight">{s.headline}</h2>
        )}
        {s.subline && <p className="text-sm sm:text-base text-[#334155] leading-relaxed max-w-xl">{s.subline}</p>}
        {s.startsAt && <DayTracker startsAt={s.startsAt} />}
      </div>

      <div className="relative flex flex-col items-center justify-center gap-3 text-center px-6 py-7 sm:py-9 bg-gradient-to-br from-[#fbf3ea] via-[#fbf8f3] to-[#e6f4fb] border-t-2 md:border-t-0 md:border-l-2 border-dashed border-[#e4c8b2]">
        <span aria-hidden="true" className="hidden md:block absolute -left-[14px] -top-[14px] w-[26px] h-[26px] rounded-full bg-[#f8f8f8]" />
        <span aria-hidden="true" className="hidden md:block absolute -left-[14px] -bottom-[14px] w-[26px] h-[26px] rounded-full bg-[#f8f8f8]" />
        {s.code && (
          <>
            <span className="text-[11px] sm:text-xs tracking-[0.4em] text-[#0b84c6]">YOUR CODE</span>
            <span className="text-4xl sm:text-5xl text-[#d9622b] tracking-wide">{s.code}</span>
          </>
        )}
        <Link
          href={href}
          onClick={onCopy}
          tabIndex={active ? 0 : -1}
          className="inline-flex items-center gap-2 bg-[#0b84c6] hover:bg-[#075f8f] text-white font-bold text-xs sm:text-sm tracking-widest uppercase px-6 py-3 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b84c6]"
        >
          {copied ? 'Copied · shopping' : s.code ? 'Copy & shop the sale' : s.cta.label}
        </Link>
        {s.endsAt && <span className="text-xs sm:text-[13px] text-[#475569]">{endsLabel(s.endsAt)}</span>}
      </div>
    </div>
  )
}
