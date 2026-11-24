'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BatIcon, PumpkinIcon } from './HalloweenArt'
import { HarvestBannerArt } from './HarvestArt'
import useHolidayOffer, { rememberPromo } from './useHolidayOffer'

// Slim site-wide sale banner. Reads the same offer_slide as the homepage
// carousel, so it appears at starts_at and disappears at ends_at with no
// deploy. Hidden on checkout (the code box is right there).

const THEME = {
  halloween: 'bg-gradient-to-r from-[#12081f] via-[#3a1556] to-[#12081f] text-white',
  harvest: 'bg-[linear-gradient(90deg,#fbf3ea_0%,#fbf8f3_40%,#eaf6fd_60%,#dff1fb_100%)] text-[#0d1b2a]',
  sale: 'bg-gradient-to-r from-[#8e1b2a] via-[#B22234] to-[#0A1F44] text-white',
}
const PILL = {
  halloween: 'bg-[#ff8a1f] text-[#12081f]',
  harvest: 'bg-[#d9622b] text-white',
  sale: 'bg-white text-[#B22234]',
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
  const { offer, now } = useHolidayOffer()
  const [onCheckout, setOnCheckout] = useState(true)
  useEffect(() => { setOnCheckout(window.location.pathname.startsWith('/checkout')) }, [])

  if (!offer || onCheckout) return null
  const tone = THEME[offer.tone] ? offer.tone : 'sale'
  const isHalloween = tone === 'halloween'
  const isHarvest = tone === 'harvest'
  const left = timeLeft(offer.endsAt, now)
  const base = offer.cta?.href || '/shop'
  const href = isHarvest && offer.code ? `${base}${base.includes('?') ? '&' : '?'}promo=${encodeURIComponent(offer.code)}` : base

  return (
    <div className={`${THEME[tone]} relative overflow-hidden`} role="region" aria-label="Current sale">
      {isHarvest && <HarvestBannerArt />}
      <Link
        href={href}
        onClick={() => isHarvest && rememberPromo(offer.code)}
        className={`relative max-w-6xl mx-auto px-4 flex items-center justify-center gap-2 sm:gap-3 text-[12px] sm:text-sm leading-tight text-center ${isHarvest ? 'py-2.5 sm:py-3' : 'py-2'}`}
      >
        {isHalloween && <BatIcon className="hidden sm:block w-7 h-3 text-[#c9a7ff] opacity-80" />}
        {isHalloween && <PumpkinIcon className="w-5 h-5 shrink-0" />}
        {isHarvest && offer.eyebrow && (
          <span className="hidden md:inline text-[13px] tracking-[0.3em] font-semibold uppercase text-[#0b84c6]">{offer.eyebrow}</span>
        )}
        <span className={isHarvest ? 'font-light sm:text-[15px]' : 'font-bold tracking-wide'}>
          {offer.headline}{isHarvest && offer.code ? ' with' : ''}
        </span>
        {offer.code && (
          <span className={`font-black tracking-widest text-[11px] sm:text-[12px] px-2.5 py-0.5 sm:py-1 rounded-full ${PILL[tone]}`}>
            {offer.code}
          </span>
        )}
        {left && <span className={`hidden sm:inline ${isHarvest ? 'text-[#334155]' : 'text-white/75'}`}>· {left}</span>}
        {isHalloween && <PumpkinIcon className="hidden sm:block w-5 h-5 shrink-0" />}
        {isHalloween && <BatIcon className="hidden sm:block w-7 h-3 text-[#c9a7ff] opacity-80 -scale-x-100" />}
      </Link>
    </div>
  )
}
