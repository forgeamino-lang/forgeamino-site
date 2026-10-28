// Klaviyo sync for new orders.
//
// On every new order we:
//   1. Track a "Placed Order" event (this also creates/updates the profile),
//   2. Add the customer to the main Email List so campaigns reach them.
//
// No-op unless KLAVIYO_PRIVATE_API_KEY is set. Never throws into the order
// flow; callers .catch() anyway.
//
// Env:
//   KLAVIYO_PRIVATE_API_KEY  (required) private key with Profiles, Lists and Events write scopes
//   KLAVIYO_LIST_ID          (optional) defaults to the main "Email List"

const API = 'https://a.klaviyo.com/api'
const REVISION = '2024-10-15'
const DEFAULT_LIST_ID = 'XvptTV'

function headers(key) {
  return {
    Authorization: `Klaviyo-API-Key ${key}`,
    revision: REVISION,
    accept: 'application/vnd.api+json',
    'content-type': 'application/vnd.api+json',
  }
}

export function splitName(full) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return {}
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
  return {
    first_name: cap(parts[0]),
    ...(parts.length > 1 ? { last_name: parts.slice(1).map(cap).join(' ') } : {}),
  }
}

export function buildPlacedOrderEvent(order) {
  const email = String(order.customer_email || '').trim().toLowerCase()
  const items = (order.line_items || []).map((li) => ({
    ProductID: li.slug || li.id || null,
    ProductName: li.name || li.qbo_name || li.slug,
    Quantity: Number(li.quantity || 1),
    ItemPrice: Number(li.price || 0),
    RowTotal: Number(li.price || 0) * Number(li.quantity || 1),
  }))
  const value = Number(order.total || 0)
  return {
    data: {
      type: 'event',
      attributes: {
        properties: {
          OrderId: order.order_number,
          Items: items,
          ItemNames: items.map((i) => i.ProductName),
          ProductSlugs: items.map((i) => i.ProductID).filter(Boolean),
          ItemCount: items.reduce((s, i) => s + i.Quantity, 0),
          Subtotal: Number(order.subtotal ?? 0),
          Discount: Number(order.discount_amount ?? 0),
          Shipping: Number(order.shipping_amount ?? 0),
          Tax: Number(order.tax_amount ?? 0),
          PaymentMethod: order.payment_method || null,
          AffiliateCode: order.affiliate_code || null,
        },
        value,
        value_currency: 'USD',
        unique_id: String(order.order_number),
        time: new Date().toISOString(),
        metric: { data: { type: 'metric', attributes: { name: 'Placed Order' } } },
        profile: {
          data: {
            type: 'profile',
            attributes: {
              email,
              ...splitName(order.customer_name),
            },
          },
        },
      },
    },
  }
}

async function call(fetchImpl, url, key, body) {
  const res = await fetchImpl(url, { method: 'POST', headers: headers(key), body: JSON.stringify(body) })
  if (!res.ok && res.status !== 409) {
    const text = await res.text().catch(() => '')
    throw new Error(`Klaviyo ${res.status} on ${url.replace(API, '')}: ${text.slice(0, 300)}`)
  }
  return res
}

export async function syncOrderToKlaviyo(order, { env = process.env, fetchImpl = fetch } = {}) {
  const key = env.KLAVIYO_PRIVATE_API_KEY
  if (!key) return { skipped: 'no api key' }
  const email = String(order?.customer_email || '').trim().toLowerCase()
  if (!email || !email.includes('@')) return { skipped: 'no email' }
  const listId = env.KLAVIYO_LIST_ID || DEFAULT_LIST_ID

  // 1) Placed Order event (creates/updates the profile as a side effect)
  await call(fetchImpl, `${API}/events`, key, buildPlacedOrderEvent(order))

  // 2) Upsert the profile to get its id, then add it to the Email List.
  //    Adding to a list does not change marketing consent or override an
  //    unsubscribe/suppression.
  const res = await call(fetchImpl, `${API}/profile-import`, key, {
    data: { type: 'profile', attributes: { email, ...splitName(order.customer_name) } },
  })
  const json = await res.json().catch(() => ({}))
  const profileId = json?.data?.id
  if (!profileId) return { event: true, list: false }
  await call(fetchImpl, `${API}/lists/${listId}/relationships/profiles`, key, {
    data: [{ type: 'profile', id: profileId }],
  })
  return { event: true, list: true, profileId }
}
