// Homepage offers carousel: the slides and the rules behind them.
//
// Every number on a slide comes from the same constants checkout uses
// (first-order %, multi-vial tiers, free-shipping threshold, catalog price),
// so the carousel can't advertise something checkout doesn't honor.
//
// Order: a live holiday/limited-time offer (if any) first, then the four
// standing offers.

import { FIRST_ORDER_PCT } from './firstOrder'
import { BULK_TIERS } from './bulkDiscount'
import { FREE_SHIPPING_THRESHOLD, FEDEX_2DAY_COST } from './shipping'
import { getProductBySlug } from './products'

// Product used for the "price per vial" example on the multi-vial slide.
export const BULK_EXAMPLE_SLUG = 'bpc-157'

const pct = n => `${Math.round(n * 100)}%`
const usd = n => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`)
const round2 = n => Math.round(n * 100) / 100

export function standingOffers() {
  const tiers = [...BULK_TIERS].sort((a, b) => a.minQty - b.minQty)
  const top = tiers[tiers.length - 1]
  const example = getProductBySlug(BULK_EXAMPLE_SLUG)
  let bulkSub = tiers.map(t => `${pct(t.pct)} off ${t.minQty}+ vials`).join(' · ') + ' of the same product. Applied automatically.'
  if (example?.price) {
    const steps = tiers.map(t => `${usd(round2(example.price * (1 - t.pct)))} at ${t.minQty}`).join(' → ')
    bulkSub = `${example.qbo_name || example.name}: ${usd(example.price)} a vial → ${steps}. Applied automatically.`
  }
  return [
    {
      id: 'first-order',
      eyebrow: 'New customers',
      headline: `${pct(FIRST_ORDER_PCT)} off your first order`,
      subline: 'Applied automatically at checkout. No code needed.',
      cta: { label: 'Shop now', href: '/shop' },
      finePrint: true,
      tone: 'blue',
    },
    {
      id: 'multi-vial',
      eyebrow: 'Multi-vial pricing',
      headline: `Stock your lab. Save up to ${pct(top.pct)}.`,
      subline: bulkSub,
      cta: { label: 'Shop peptides', href: '/shop' },
      finePrint: true,
      tone: 'navy',
    },
    {
      id: 'free-shipping',
      eyebrow: 'Shipping',
      headline: `Free FedEx 2-Day on orders ${usd(FREE_SHIPPING_THRESHOLD)}+`,
      subline: `Orders under ${usd(FREE_SHIPPING_THRESHOLD)} ship FedEx 2-Day for ${usd(FEDEX_2DAY_COST)}.`,
      cta: { label: 'Shop now', href: '/shop' },
      finePrint: false,
      tone: 'sky',
    },
    {
      id: 'third-party-tested',
      eyebrow: 'Third-party tested',
      headline: 'Every compound independently tested.',
      subline: '99%+ purity verified in a US laboratory, with a QR-linked COA on every vial.',
      cta: { label: 'See lab results', href: '/lab-results' },
      finePrint: false,
      tone: 'slate',
    },
  ]
}

// A limited-time offer stored in site_config under the key `offer_slide`,
// as JSON:
//   { "headline": "Black Friday: 25% off everything",
//     "subline": "Through Monday at midnight.",
//     "code": "BLACKFRIDAY25",              (optional)
//     "cta_label": "Shop the sale",        (optional, default "Shop now")
//     "cta_href": "/shop",                 (optional, default "/shop")
//     "eyebrow": "Holiday sale",           (optional, default "Limited time")
//     "starts_at": "2026-11-27T06:00:00Z", (optional)
//     "ends_at":   "2026-12-01T05:59:59Z", (optional; the slide disappears after this)
//     "active": true }
// Anything malformed, switched off, not started or expired returns null.
export function parseHolidayOffer(raw, now = new Date()) {
  if (!raw) return null
  let o = raw
  if (typeof raw === 'string') {
    try { o = JSON.parse(raw) } catch { return null }
  }
  if (!o || typeof o !== 'object') return null
  if (o.active === false || o.active === 'false') return null
  const headline = String(o.headline || '').trim()
  if (!headline) return null
  const t = now.getTime()
  if (o.starts_at) { const s = new Date(o.starts_at).getTime(); if (Number.isFinite(s) && t < s) return null }
  if (o.ends_at) { const e = new Date(o.ends_at).getTime(); if (Number.isFinite(e) && t >= e) return null }
  const href = String(o.cta_href || '/shop')
  return {
    id: 'holiday',
    eyebrow: String(o.eyebrow || 'Limited time').trim(),
    headline,
    subline: String(o.subline || '').trim(),
    code: o.code ? String(o.code).trim().toUpperCase() : null,
    cta: { label: String(o.cta_label || 'Shop now').trim(), href: href.startsWith('/') ? href : '/shop' },
    finePrint: false,
    tone: 'sale',
    endsAt: o.ends_at || null,
  }
}

export function buildOffers(holiday) {
  return holiday ? [holiday, ...standingOffers()] : standingOffers()
}
