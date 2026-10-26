// Rules for sale/promo codes (affiliates rows with is_promo = true, e.g.
// HALLOWEEN25), shared by checkout and the orders API.
//
// - A code is live only between starts_at and expires_at (either optional).
// - A promo code never takes affiliate credit or a sticky attribution lock.
//   It belongs in the checkout's promo line, so the affiliate line stays
//   free for the rep who referred the customer.
// - Two code discounts never stack: when both the affiliate code and the
//   promo code carry a discount, the customer gets the larger one. (The
//   multi-vial and first-order rules then compare that against their own
//   discount, as before.)

export function isCodeLive(row, now = new Date()) {
  if (!row || row.active === false) return false
  const t = now.getTime()
  if (row.starts_at) {
    const s = new Date(row.starts_at).getTime()
    if (Number.isFinite(s) && t < s) return false
  }
  if (row.expires_at) {
    const e = new Date(row.expires_at).getTime()
    if (Number.isFinite(e) && t >= e) return false
  }
  return true
}

// Returns { amount, source } where source is 'affiliate', 'promo' or 'none'.
// Ties go to the promo code (it's the one the customer typed for the sale).
export function combineCodeDiscounts(affiliateAmount = 0, promoAmount = 0) {
  const a = Number(affiliateAmount) > 0 ? Number(affiliateAmount) : 0
  const p = Number(promoAmount) > 0 ? Number(promoAmount) : 0
  if (!(a > 0) && !(p > 0)) return { amount: 0, source: 'none' }
  if (p >= a) return { amount: round2(p), source: 'promo' }
  return { amount: round2(a), source: 'affiliate' }
}

const round2 = n => Math.round(n * 100) / 100
