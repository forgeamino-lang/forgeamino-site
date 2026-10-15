'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'

// Homepage offers carousel. Slides come from lib/offers.js (server side).
// Auto-advances every 5.5s; pauses while hovered, focused or touched, and
// doesn't auto-advance at all for visitors who prefer reduced motion.

const INTERVAL_MS = 5500

const TONES = {
  blue: 'from-[#1565c0] via-[#1e88e5] to-[#4fc3f7]',
  navy: 'from-[#0d1b2a] via-[#16314f] to-[#1f4b78]',
  sky: 'from-[#0b5394] via-[#1976d2] to-[#2196f3]',
  slate: 'from-[#1a2e45] via-[#22405f] to-[#2e5a85]',
  sale: 'from-[#8e1b2a] via-[#B22234] to-[#0A1F44]',
}

export default function OffersCarousel({ slides = [] }) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reduced, setReduced] = useState(false)
  const touch = useRef(null)
  const n = slides.length

  const go = useCallback(k => setI(v => (k + n) % n), [n])
  const next = useCallback(() => setI(v => (v + 1) % n), [n])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const set = () => setReduced(mq.matches)
    set(); mq.addEventListener?.('change', set)
    return () => mq.removeEventListener?.('change', set)
  }, [])

  useEffect(() => {
    if (n < 2 || paused || reduced) return
    const t = setTimeout(next, INTERVAL_MS)
    return () => clearTimeout(t)
  }, [i, n, paused, reduced, next])

  if (!n) return null

  const onTouchStart = e => { touch.current = e.touches[0].clientX; setPaused(true) }
  const onTouchEnd = e => {
    const start = touch.current; touch.current = null
    if (start == null) return
    const dx = e.changedTouches[0].clientX - start
    if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1))
    setTimeout(() => setPaused(false), 4000)
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Current offers"
      className="bg-[#f3f7fc] py-8 sm:py-12"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div
          className="relative overflow-hidden rounded-2xl shadow-[0_10px_30px_-12px_rgba(13,27,42,0.45)]"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div
            className="flex transition-transform duration-500 ease-out motion-reduce:transition-none"
            style={{ transform: `translateX(-${i * 100}%)` }}
          >
            {slides.map((s, k) => (
              <div
                key={s.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${k + 1} of ${n}: ${s.headline}`}
                aria-hidden={k !== i}
                className={`w-full shrink-0 bg-gradient-to-br ${TONES[s.tone] || TONES.navy} text-white`}
              >
                <div className="px-6 sm:px-20 py-9 sm:py-12 min-h-[230px] sm:min-h-[250px] flex flex-col justify-center gap-3 max-w-3xl">
                  <p className="text-[11px] sm:text-xs font-bold tracking-[0.2em] uppercase text-white/80">{s.eyebrow}</p>
                  <h2 className="text-2xl sm:text-4xl font-black leading-tight tracking-tight [text-wrap:balance]">{s.headline}</h2>
                  {s.subline && <p className="text-sm sm:text-base text-white/90 leading-relaxed max-w-xl">{s.subline}</p>}
                  {s.code && (
                    <p className="text-sm text-white/90">
                      Use code{' '}
                      <span className="inline-block bg-white text-[#B22234] font-black tracking-widest text-xs px-2.5 py-1 rounded-full align-middle">{s.code}</span>
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2">
                    <Link
                      href={s.cta.href}
                      tabIndex={k === i ? 0 : -1}
                      className="inline-block bg-white text-[#0d1b2a] hover:bg-[#e3f2fd] font-bold text-xs sm:text-sm tracking-widest uppercase px-6 py-3 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
                      {s.cta.label}
                    </Link>
                    {s.finePrint && (
                      <span className="text-[11px] sm:text-xs text-white/70">The best available discount applies automatically at checkout.</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {n > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(i - 1)}
                aria-label="Previous offer"
                className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full bg-white/15 hover:bg-white/30 text-white text-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => go(i + 1)}
                aria-label="Next offer"
                className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full bg-white/15 hover:bg-white/30 text-white text-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              >
                ›
              </button>
            </>
          )}
        </div>

        {n > 1 && (
          <div className="flex justify-center gap-2 mt-4" role="tablist" aria-label="Choose an offer">
            {slides.map((s, k) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={k === i}
                aria-label={`Show offer ${k + 1}: ${s.eyebrow}`}
                onClick={() => go(k)}
                className={`h-2 rounded-full transition-all ${k === i ? 'w-6 bg-[#1e88e5]' : 'w-2 bg-[#b9c7d8] hover:bg-[#8fa6c0]'}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
