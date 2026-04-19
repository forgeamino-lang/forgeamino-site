// Shipping policy — single source of truth for both Shop and Lab orders.
// Imported by lib/orderValidation.js (server) and app/checkout/page.js (client).
// Keep this file dependency-free so it can run in either runtime.

export const FREE_SHIPPING_THRESHOLD = 250
export const FEDEX_2DAY_COST = 12

export const SHIPPING_METHODS = {
  fedex_2day: { id: 'fedex_2day', label: 'FedEx 2-Day' },
  local_delivery: { id: 'local_delivery', label: 'Local Delivery' },
}

export function shippingLabel(method) {
  return (SHIPPING_METHODS[method] || SHIPPING_METHODS.fedex_2day).label
}

/**
 * Compute shipping cost (in dollars, rounded to cents).
 *   - local_delivery  → always $0
 *   - fedex_2day      → $0 when subtotal >= FREE_SHIPPING_THRESHOLD else $12
 *   - unknown methods fall through to fedex_2day
 */
export function computeShipping(subtotal, method) {
  const m = SHIPPING_METHODS[method] ? method : 'fedex_2day'
  if (m === 'local_delivery') return 0
  const s = Number(subtotal) || 0
  return s >= FREE_SHIPPING_THRESHOLD ? 0 : FEDEX_2DAY_COST
}
