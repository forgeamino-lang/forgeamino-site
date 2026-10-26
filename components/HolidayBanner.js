'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BatIcon, PumpkinIcon } from './HalloweenArt'

// Slim site-wide sale banner. Reads the same offer_slide as the homepage
// carousel, so it appears at starts_at and disappears at ends_at with no
// deploy. Hidden on checkout (the code box is right there).

const THEME = {
  halloween: 'bg-gradient-to-r from-[#12081f] via-[#3a1556] to-[#12081f] text-white',
  sale: 'bg-gradient-to-r from-[#8e1b2a] via-[#B22234] to-[#0A1F44] text-white',
}

function timeLeft(endsAt, now) {
  if (!endsAt) return null
  const ms = new Date(endsAt).getTime() - now
  if (!(ms > 0)) return null
  const h = Math.floor(ms / 3.6e6)
  if (h >= 48) return `${Math.floor(h / 24)} days left`
  if (h >= 1) return `${h} hr${h === 1 ? '' : 's'} left`
  return 'Ends soon'
}

export default function HolidayBanner() {
  const [offer, setOffer] = useState(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (window.location.pathname.startsWith('/checkout')) return
    let alive = true
    fetch('/api/holiday-offer')
      .then(r => r.json())
      .then(j => { if (alive) setOffer(j?.offer || null) })
      .catch(() => {})
    const t = setInterval(() => setNow(Date.now()), 60000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  if (!offer) return null
  if (offer.endsAt && new Date(offer.endsAt).getTime() <= now) return null
  const isHalloween = offer.tone === 'halloween'
  const left = timeLeft(offer.endsAt, now)

  return (
    <div className={`${THEME[offer.tone] || THEME.sale} relative overflow-hidden`} role="region" aria-label="Current sale">
      <Link
        href={offer.cta?.href || '/shop'}
        className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-center gap-2 sm:gap-3 text-[12px] sm:text-sm leading-tight text-center"
      >
        {isHalloween && <BatIcon className="hidden sm:block w-7 h-3 text-[#c9a7ff] opacity-80" />}
        {isHalloween && <PumpkinIcon className="w-5 h-5 shrink-0" />}
        <span className="font-bold tracking-wide">{offer.headline}</span>
        {offer.code && (
          <span className={`font-black tracking-widest text-[11px] px-2 py-0.5 rounded-full ${isHalloween ? 'bg-[#ff8a1f] text-[#12081f]' : 'bg-white text-[#B22234]'}`}>
            {offer.code}
          </span>
        )}
        {left && <span className="hidden sm:inline text-white/75">· {left}</span>}
        {isHalloween && <PumpkinIcon className="hidden sm:block w-5 h-5 shrink-0" />}
        {isHalloween && <BatIcon className="hidden sm:block w-7 h-3 text-[#c9a7ff] opacity-80 -scale-x-100" />}
      </Link>
    </div>
  )
}
