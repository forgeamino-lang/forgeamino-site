// Store credit codes — single-use dollar credits (e.g. the Oct 2026 win-back
// campaign: "You have $67 to spend"). Single source of truth for the rules,
// shared by the checkout page (client), /api/store-credit/preview and the
// orders API (server).
//
// Rules (set by Sean, Oct 2026):
//   - One code per customer, tied to the email it was sent to.
//   - Single use. Redeemed when the order is placed.
//   - Must be switched on (active) and not past expires_at. Codes load
//     switched off and are switched on, with an expiry 30 days out, on the
//     day the campaign is sent.
//   - Minimum order is checked against the product subtotal BEFORE any
//     discount (shipping and tax never count).
//   - Stacks with everything: FRIENDS, FAMILY, other codes and the
//     multi-vial discount. The credit comes off LAST, after whichever
//     discount the order already gets.
//   - Never takes the product subtotal below $0 and never covers shipping
//     or tax. Any unused remainder is forfeited (single use).
//   - Only one credit code per order.

export const STORE_CREDIT_LABEL = 'Store credit'

const round2 = n => Math.round(n * 100) / 100

export function normalizeCreditCode(raw) {
  return String(raw || '').trim().toUpperCase().replace(/\s+/g, '')
}

// Looks like a credit code (BACK67-T6DVR). Used only to steer a code typed
// into the wrong box; the database is the authority on whether it exists.
export function looksLikeCreditCode(raw) {
  return /^BACK\d{1,4}-[A-Z0-9]{4,8}$/.test(normalizeCreditCode(raw))
}

// Decide whether a credit row can be used on an order.
//   credit: the store_credits row (or null when the code wasn't found)
//   email: the email on the order
//   subtotalBeforeDiscount: product subtotal at catalog prices
//   subtotalAfterDiscount: product subtotal after FRIENDS / multi-vial / etc.
// Returns { ok: true, amount } or { ok: false, reason, message, ... }.
// 'not_found' and 'wrong_email' share one message so the preview endpoint
// never confirms that a code exists for someone else's email.
export function evaluateStoreCredit(credit, { email, subtotalBeforeDiscount, subtotalAfterDiscount, now = new Date() } = {}) {
  const NOT_VALID = 'That credit code isn’t valid for this email address. Use the email the code was sent to.'
  if (!credit) return { ok: false, reason: 'not_found', message: NOT_VALID }
  const e = String(email || '').trim().toLowerCase()
  if (!e || e !== String(credit.customer_email || '').toLowerCase()) {
    return { ok: false, reason: 'wrong_email', message: NOT_VALID }
  }
  if (credit.redeemed_at) {
    return { ok: false, reason: 'redeemed', message: 'This credit code has already been used.' }
  }
  if (!credit.active) {
    return { ok: false, reason: 'inactive', message: 'This credit code isn’t active yet.' }
  }
  if (credit.expires_at && new Date(credit.expires_at) <= now) {
    return { ok: false, reason: 'expired', message: 'This credit code has expired.' }
  }
  const amount = Number(credit.amount) || 0
  const minOrder = Number(credit.min_order) || 0
  const before = Number(subtotalBeforeDiscount) || 0
  if (before < minOrder) {
    return {
      ok: false,
      reason: 'below_minimum',
      message: `Your $${amount} credit applies to orders of $${minOrder} or more. Add $${round2(minOrder - before).toFixed(2)} more to use it.`,
      amount,
      min_order: minOrder,
      shortfall: round2(minOrder - before),
    }
  }
  const after = Math.max(0, Number(subtotalAfterDiscount ?? before) || 0)
  return { ok: true, amount: round2(Math.min(amount, after)), face_amount: amount, min_order: minOrder }
}

// Splits an order's combined discount_amount into the code/multi-vial part
// and the store-credit part, for the confirmation email and QuickBooks.
// Orders without a credit come back unchanged.
export function discountBreakdown(order) {
  const sa = order?.shipping_address || {}
  const total = Number(order?.discount_amount ?? sa.discount_amount ?? 0) || 0
  const credit = Number(sa.store_credit_amount ?? 0) || 0
  return {
    total: round2(total),
    credit: round2(credit),
    creditCode: sa.store_credit_code || null,
    other: round2(Math.max(0, total - credit)),
  }
}
