'use client'

import { useEffect, useState } from 'react'

// The live sale (or null), fetched once per page load and shared by the
// site banner and every product card. Re-checks ends_at each minute so
// sale styling disappears on time without a reload.

let pending = null
function load() {
  if (!pending) {
    pending = fetch('/api/holiday-offer')
      .then(r => r.json())
      .then(j => j?.offer || null)
      .catch(() => { pending = null; return null })
  }
  return pending
}

export default function useHolidayOffer() {
  const [offer, setOffer] = useState(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let alive = true
    load().then(o => { if (alive) setOffer(o) })
    const t = setInterval(() => setNow(Date.now()), 60000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  if (!offer) return { offer: null, now }
  if (offer.endsAt && new Date(offer.endsAt).getTime() <= now) return { offer: null, now }
  if (offer.startsAt && new Date(offer.startsAt).getTime() > now) return { offer: null, now }
  return { offer, now }
}

// Puts the sale code where checkout picks it up, for in-site links
// (AffiliateTracker only reads ?promo= on a full page load).
export function rememberPromo(code) {
  try { if (code) sessionStorage.setItem('promoCode', String(code).toUpperCase()) } catch {}
}
