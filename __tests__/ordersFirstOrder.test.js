import { describe, test, expect, vi, beforeEach } from 'vitest'

// ── In-memory Supabase: affiliates + store_credits ──────────────────────
const AFFILIATES = {
  FRIENDS: { id: 'a1', code: 'FRIENDS', discount_pct: 0.1, discount_to_cost: false, discount_to_fixed_price: false, product_prices: null, email_whitelist: null },
  FAMILY: { id: 'a2', code: 'FAMILY', discount_pct: 0, discount_to_cost: false, discount_to_fixed_price: true, product_prices: { 'BPC-157': 45 }, email_whitelist: null },
}
let CREDITS = {}
let inserted = null
let insertError = null
let PRIOR = new Set(['repeat@x.com'])
let rpcFail = false

function builder(table) {
  const q = { filters: {}, isNull: [], patch: null }
  const matches = (row) => Object.entries(q.filters).every(([k, v]) => row[k] === v) && q.isNull.every(k => row[k] == null)
  const self = {
    select: () => self, or: () => self,
    eq: (k, v) => { q.filters[k] = v; return self },
    is: (k, v) => { if (v === null) q.isNull.push(k); return self },
    ilike: (k, v) => { q.filters[k] = String(v).toUpperCase(); return self },
    maybeSingle: async () => {
      if (table === 'affiliates') return { data: AFFILIATES[q.filters.code] || null }
      if (table === 'store_credits') return { data: CREDITS[q.filters.code] ? { ...CREDITS[q.filters.code] } : null }
      return { data: null }
    },
    single: async () => (insertError ? { data: null, error: insertError } : { data: { id: 'order-1' }, error: null }),
    insert: (row) => { inserted = row; return self },
    upsert: async () => ({ data: null }),
    update: (patch) => { q.patch = patch; return self },
    then: (resolve) => {
      // Executes an awaited update (with or without .select()).
      if (table === 'store_credits' && q.patch) {
        const hits = Object.values(CREDITS).filter(matches)
        hits.forEach(r => Object.assign(r, q.patch))
        return resolve({ data: hits.map(r => ({ id: r.code })), error: null })
      }
      return resolve({ data: null, error: null })
    },
  }
  return self
}

vi.mock('../lib/supabase', () => ({
  createServerClient: () => ({ from: (t) => builder(t), rpc: async (fn, a) => (rpcFail ? { data: null, error: new Error('down') } : { data: PRIOR.has(String(a.p_email).toLowerCase()), error: null }) }),
  generateOrderNumber: async () => 'FA-TEST3',
}))
vi.mock('../lib/email', () => ({ sendOrderConfirmationEmail: vi.fn(async () => ({})), sendOrderReceivedAlert: vi.fn(async () => ({})) }))
vi.mock('../lib/quickbooks', () => ({ syncToQuickBooks: vi.fn(async () => ({})), checkInvoiceDocNumberExists: vi.fn(async () => false), getAccessToken: vi.fn(async () => 't'), fetchQboItems: vi.fn(async () => new Map()) }))
vi.mock('../lib/pushNotify', () => ({ broadcastOrderNotification: vi.fn(async () => ({})) }))
vi.mock('../lib/adminAuth', () => ({ requireAdmin: vi.fn() }))
vi.mock('../lib/labAuth', () => ({ verifyLabCookie: () => false }))
vi.mock('../lib/lut', () => ({ chargeLutTransaction: vi.fn(async () => ({ ok: false, error: 'declined' })) }))
vi.mock('../lib/trybe', () => ({ submitOrderToTrybe: vi.fn(async () => ({})), getTrybeVisitorId: () => null }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

const { POST } = await import('../app/api/orders/route.js')

const FUTURE = new Date(Date.now() + 20 * 86400e3).toISOString()
beforeEach(() => {
  inserted = null; insertError = null; rpcFail = false
  CREDITS = {
    'BACK23-ABCDE': { code: 'BACK23-ABCDE', customer_email: 'jane@x.com', amount: 23, min_order: 125, active: true, expires_at: FUTURE, redeemed_at: null, order_number: null, order_id: null },
    'BACK94-ZZZZZ': { code: 'BACK94-ZZZZZ', customer_email: 'rod@x.com', amount: 94, min_order: 475, active: false, expires_at: null, redeemed_at: null, order_number: null, order_id: null },
  }
})

async function placeOrder({ items, affiliate_code = null, store_credit_code = null, email = 'jane@x.com', payment_method = 'venmo', extra = {} }) {
  const req = new Request('http://x/api/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'Jane Test', customer_email: email, customer_phone: '5555555555',
      shipping_address: { street: '1 Main St', city: 'Norman', state: 'OK', zip: '73069' },
      payment_method, shipping_method: 'fedex_2day', tax_rate: 0.1,
      line_items: items, affiliate_code, store_credit_code, ...extra,
    }),
  })
  const res = await POST(req)
  return { status: res.status, body: await res.json(), order: inserted }
}
const bpc = q => ({ slug: 'bpc-157', quantity: q }) // $70

describe('orders API — first-order discount', () => {
  test('new customer: 15% off automatically', async () => {
    const { status, order } = await placeOrder({ items: [bpc(2)], email: 'new@x.com' })
    expect(status).toBe(200)
    expect(order.discount_amount).toBe(21)
    expect(order.shipping_address.discount_source).toBe('first_order')
    expect(order.shipping_address.discount_label).toBe('First-order discount')
    expect(order.shipping_address.subtotal).toBe(119)
  })

  test('returning customer: no discount', async () => {
    const { order } = await placeOrder({ items: [bpc(2)], email: 'repeat@x.com' })
    expect(order.discount_amount).toBe(0)
    expect(order.shipping_address.first_order_eligible).toBeUndefined()
  })

  test('new customer with FRIENDS: 15% wins, FRIENDS not stacked, affiliate still credited', async () => {
    const { order } = await placeOrder({ items: [bpc(2)], affiliate_code: 'FRIENDS', email: 'new@x.com' })
    expect(order.discount_amount).toBe(21)
    expect(order.affiliate_code).toBe('FRIENDS')
    expect(order.shipping_address.code_discount_declined).toBe(14)
  })

  test('new customer buying 5 vials: multi-vial 20% wins over 15%', async () => {
    const { order } = await placeOrder({ items: [bpc(5)], email: 'new@x.com' })
    expect(order.discount_amount).toBe(70)
    expect(order.shipping_address.discount_source).toBe('bulk')
    expect(order.shipping_address.first_order_discount_available).toBe(52.5)
  })

  test('new customer with FAMILY pricing that saves more: FAMILY wins', async () => {
    const { order } = await placeOrder({ items: [bpc(2)], affiliate_code: 'FAMILY', email: 'new@x.com' })
    expect(order.discount_amount).toBe(50)
    expect(order.shipping_address.discount_source).toBe('code')
  })

  test('check unavailable: fails closed, no discount, order still placed', async () => {
    rpcFail = true
    const { status, order } = await placeOrder({ items: [bpc(2)], email: 'new@x.com' })
    expect(status).toBe(200)
    expect(order.discount_amount).toBe(0)
  })
})
