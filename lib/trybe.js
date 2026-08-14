// Trybe (jointrybe.com) creator-marketing attribution — server-side Orders API.
//
// The client-side pixel (installed in app/layout.js head) tracks page views
// and sets a first-party visitor-id cookie. That alone is unreliable for
// revenue attribution (ad blockers, JS errors), so per Trybe's integration
// guide we also report every completed order server-side here. Without a
// matching visitor id there's nothing for Trybe to attribute the order to,
// so we simply skip the call rather than send a request that can't succeed.
//
// Docs: https://jointrybe.com/help/brand-guides/trybe-pixel-and-orders-api

const TRYBE_STORE_ID = 'f75dc740-f16b-44f8-adf5-9afa6866c60b'
const TRYBE_ORDERS_ENDPOINT = 'https://jointrybe.com/attribution/v1/orders'

// Reads the Trybe visitor-id cookie the pixel sets on the storefront.
// Checks the store-scoped cookie name first, falling back to the generic one.
export function getTrybeVisitorId(request) {
  return (
    request.cookies.get(`ugc_vid_${TRYBE_STORE_ID}`)?.value ||
    request.cookies.get('ugc_vid')?.value ||
    null
  )
}

export async function submitOrderToTrybe(order, vid) {
  const apiKey = process.env.TRYBE_API_KEY
  if (!apiKey) {
    console.warn('TRYBE_API_KEY not set — skipping Trybe order submission')
    return null
  }
  if (!vid) {
    // No creator-attributed click on this order (organic / direct / no
    // pixel cookie) — nothing for Trybe to attribute, so don't bother.
    return null
  }

  const payload = {
    apiKey,
    orderId: order.order_number,
    // Net product revenue (after discount, before tax/shipping) — matches
    // the "product sales" figure used everywhere else in this codebase for
    // commission math, since Trybe uses this value for creator payouts.
    value: Number(order.subtotal ?? order.total ?? 0),
    currency: 'USD',
    vid,
    email: order.customer_email,
    orderTime: new Date().toISOString(),
    items: (order.line_items || []).map(item => ({
      productId: item.slug || String(item.id),
      productName: item.name,
      quantity: item.quantity,
      price: item.price,
    })),
  }

  const response = await fetch(TRYBE_ORDERS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => ({}))

  // 409 = we already reported this order (safe to ignore, not a failure).
  if (!response.ok && response.status !== 409) {
    throw new Error(`Trybe order submission failed: ${response.status} ${JSON.stringify(data)}`)
  }
  return data
}
