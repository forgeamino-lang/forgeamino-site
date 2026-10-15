// First-order discount — 15% off a customer's first Forge Amino order,
// applied automatically at checkout (no code to share or leak).
//
// Rules (set by Sean, Oct 2026):
//   - 15% off the product subtotal. No minimum order.
//   - "First order" = no earlier non-cancelled order (paid or pending)
//     matching ANY of: email, phone or shipping address. Matching is done
//     in the database (public.fa_has_prior_order) with normalization:
//       email   lower-case, +tags dropped, Gmail dots ignored
//       phone   last 10 digits
//       address street + 5-digit ZIP, words abbreviated, unit labels dropped
//   - Never combined with FRIENDS / FAMILY / multi-vial: the customer gets
//     whichever saves the most (chooseDiscount in lib/bulkDiscount.js).
//     Member pricing (OWNERS) is exempt. Store credit still stacks on top.
//   - If the check can't run, no discount (fail closed).

export const FIRST_ORDER_PCT = 0.15
export const FIRST_ORDER_LABEL = 'First-order discount'

const round2 = n => Math.round(n * 100) / 100

export function firstOrderAmount(subtotal) {
  return round2((Number(subtotal) || 0) * FIRST_ORDER_PCT)
}

// Enough information to check? Email plus a street and 5-digit ZIP. Phone
// is used when present. Without an address the check isn't run, so the
// discount can't be claimed with a fresh email alone.
export function canCheckFirstOrder({ email, street, zip } = {}) {
  return /.+@.+\..+/.test(String(email || '').trim()) &&
    String(street || '').trim().length >= 4 &&
    String(zip || '').replace(/\D/g, '').length >= 5
}

// Server only. Returns true when this looks like the person's first order.
export async function isFirstOrder(supabase, { email, phone, street, zip }) {
  if (!canCheckFirstOrder({ email, street, zip })) return false
  const { data, error } = await supabase.rpc('fa_has_prior_order', {
    p_email: email || null,
    p_phone: phone || null,
    p_street: street || null,
    p_zip: zip || null,
  })
  if (error) throw error
  return data === false
}
