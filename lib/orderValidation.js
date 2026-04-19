import { getProductBySlug } from './products'
import { computeShipping } from './shipping'

/**
 * Validate + enrich client-submitted line items against the server catalog.
 *
 * Rules:
 *   - Each line_item must carry a slug that matches a known product.
 *   - If the product is marked hidden (Lab-only), the caller MUST pass
 *     hasLabAccess: true (verified upstream from the Lab session cookie).
 *   - Client-supplied price is IGNORED — the server substitutes the
 *     catalog price.
 *   - Quantity is clamped to [1, 99] and coerced to int.
 *   - qbo_name is enriched from the catalog so QBO maps to the right SKU.
 *
 * Returns:
 *   { ok: true, validated: [...] }          — on success
 *   { ok: false, status, error }            — on any validation failure
 */
export function validateLineItems(line_items, { hasLabAccess = false } = {}) {
  if (!Array.isArray(line_items) || line_items.length === 0) {
    return { ok: false, status: 400, error: 'Missing required fields' }
  }
  const validated = []
  for (const raw of line_items) {
    const slug = typeof raw?.slug === 'string' ? raw.slug.trim() : ''
    if (!slug) return { ok: false, status: 400, error: 'Missing product slug' }
    const product = getProductBySlug(slug)
    if (!product) return { ok: false, status: 400, error: `Unknown product: ${slug}` }
    if (product.hidden && !hasLabAccess) {
      return { ok: false, status: 401, error: 'Access denied' }
    }
    const qty = Math.max(1, Math.min(99, parseInt(raw.quantity, 10) || 1))
    validated.push({
      id: product.id,
      slug: product.slug,
      name: product.name,
      qbo_name: product.qbo_name || product.name,
      price: product.price,
      quantity: qty,
      image: product.image || null,
    })
  }
  return { ok: true, validated }
}

/**
 * Compute server-trusted order totals. Tax rate comes from the client
 * (location-dependent), but the subtotal and resulting tax amount are
 * derived from the validated catalog prices.
 */
export function computeOrderTotals(validated_line_items, tax_rate, shipping_method) {
  const subtotal = Number(
    validated_line_items.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2)
  )
  const rate = Number.isFinite(Number(tax_rate)) ? Number(tax_rate) : 0
  const tax_amount = Number((subtotal * rate).toFixed(2))
  // Shipping is not taxed (per business rule) — tax base stays on subtotal only.
  const method = shipping_method || 'fedex_2day'
  const shipping_amount = Number(computeShipping(subtotal, method).toFixed(2))
  const total = Number((subtotal + tax_amount + shipping_amount).toFixed(2))
  return { subtotal, tax_rate: rate, tax_amount, shipping_method: method, shipping_amount, total }
}
