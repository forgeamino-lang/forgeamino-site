// Multi-vial ("Bundle & Save") discount — single source of truth.
// Imported by the product page, cart, checkout (client) and the orders API
// (server) so the tiers and the no-stacking rule live in exactly one place.
//
// Rules (set by Sean, Oct 2026):
//   - 5+ of the same product  → 20% off that line
//   - 10+ of the same product → 30% off that line
//   - Never combined with discount codes. When an order qualifies, the
//     customer gets whichever saves them more on the whole order: the
//     multi-vial discount OR their code discount(s) — never both. Ties go to
//     the multi-vial discount.
//   - Member pricing codes (whitelisted codes such as OWNERS) are exempt:
//     those orders always get member pricing and no multi-vial discount.
//   - Eligible: Shop products only. Not supplies (BAC water, acetic acid),
//     not Lab-only (hidden) items, not compounded prescription items.
//     A product can also opt out with `bulkDiscount: false` in products.js.

import { getProductBySlug } from './products'

// Highest tier first so the first match wins.
export const BULK_TIERS = [
  { minQty: 10, pct: 0.30, badge: 'Bulk' },
  { minQty: 5, pct: 0.20, badge: 'Most Popular' },
]

const round2 = n => Math.round(n * 100) / 100

export function isBulkEligible(product) {
  if (!product) return false
  if (product.bulkDiscount === false) return false
  if (product.hidden || product.prescription) return false
  if (product.category === 'supplies' || product.category === 'prescription') return false
  return true
}

export function bulkTierFor(quantity) {
  const q = Number(quantity) || 0
  return BULK_TIERS.find(t => q >= t.minQty) || null
}

// lines: [{ slug, price, quantity }]. On the server, pass validated line
// items (catalog prices). Eligibility is always read from the catalog.
export function computeBulkDiscount(lines) {
  let total = 0
  const per_line = []
  for (const li of lines || []) {
    const product = getProductBySlug(li.slug)
    const qty = Number(li.quantity) || 0
    const price = Number(li.price) || 0
    const tier = isBulkEligible(product) ? bulkTierFor(qty) : null
    const discount = tier ? round2(price * qty * tier.pct) : 0
    total += discount
    per_line.push({ slug: li.slug, quantity: qty, pct: tier ? tier.pct : 0, discount })
  }
  return { discount_amount: round2(total), per_line }
}

// Next tier the customer could reach on this line, for "add N more" nudges.
// Returns null when the product isn't eligible or the top tier is reached.
export function nextBulkTier(product, quantity) {
  if (!isBulkEligible(product)) return null
  const q = Number(quantity) || 0
  const next = [...BULK_TIERS].reverse().find(t => q < t.minQty)
  return next ? { ...next, needed: next.minQty - q } : null
}

// Decide which discount the order receives. Never both.
//   'member' — member pricing code (e.g. OWNERS); multi-vial not applied
//   'bulk'   — multi-vial discount; code discounts dropped
//   'code'   — code discount(s); multi-vial dropped (code saved more)
//   'none'   — nothing to apply
export function chooseDiscount({ bulkAmount = 0, codeAmount = 0, memberPricing = false }) {
  if (memberPricing && codeAmount > 0) return 'member'
  if (bulkAmount > 0 && bulkAmount >= codeAmount) return 'bulk'
  if (codeAmount > 0) return 'code'
  return 'none'
}

export const BULK_DISCOUNT_LABEL = 'Multi-vial discount'
