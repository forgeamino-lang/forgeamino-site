import { describe, test, expect, vi, beforeEach } from 'vitest'

// ── In-memory Supabase: affiliates + store_credits ──────────────────────
const AFFILIATES = {
  FRIENDS: { id: 'a1', code: 'FRIENDS', discount_pct: 0.1, discount_to_cost: false, discount_to_fixed_price: false, product_prices: null, email_whitelist: null },
  FAMILY: { id: 'a2', code: 'FAMILY', discount_pct: 0, discount_to_cost: false, discount_to_fixed_price: true, product_prices: { 'BPC-157': 45 }, email_whitelist: null },
}
let CREDITS = {}
let inserted = null
let insertError = null

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
  createServerClient: () => ({ from: (t) => builder(t) }),
  generateOrderNumber: async () => 'FA-TEST2',
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
  inserted = null; insertError = null
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
      shipping_address: { line1: '1 Main', city: 'Norman', state: 'OK', zip: '73069' },
      payment_method, shipping_method: 'fedex_2day', tax_rate: 0.1,
      line_items: items, affiliate_code, store_credit_code, ...extra,
    }),
  })
  const res = await POST(req)
  return { status: res.status, body: await res.json(), order: inserted }
}
const bpc = q => ({ slug: 'bpc-157', quantity: q }) // $70

describe('orders API — store credit', () => {
  test('credit alone: $23 off a $140 order, tax on the reduced subtotal, code redeemed', async () => {
    const { status, order } = await placeOrder({ items: [bpc(2)], store_credit_code: 'back23-abcde' })
    expect(status).toBe(200)
    expect(order.discount_amount).toBe(23)
    expect(order.shipping_address.subtotal).toBe(117)
    expect(order.shipping_address.tax_amount).toBe(11.7)
    expect(order.shipping_address.store_credit_code).toBe('BACK23-ABCDE')
    expect(order.shipping_address.store_credit_amount).toBe(23)
    expect(CREDITS['BACK23-ABCDE'].redeemed_at).toBeTruthy()
    expect(CREDITS['BACK23-ABCDE'].order_id).toBe('order-1')
  })

  test('stacks with FRIENDS: 10% first, then the credit', async () => {
    const { order } = await placeOrder({ items: [bpc(2)], affiliate_code: 'FRIENDS', store_credit_code: 'BACK23-ABCDE' })
    expect(order.discount_amount).toBe(37) // 14 + 23
    expect(order.shipping_address.subtotal).toBe(103)
    expect(order.affiliate_code).toBe('FRIENDS')
  })

  test('stacks with the multi-vial discount', async () => {
    const { order } = await placeOrder({ items: [bpc(5)], store_credit_code: 'BACK23-ABCDE' })
    expect(order.discount_amount).toBe(93) // 70 multi-vial + 23
    expect(order.shipping_address.discount_source).toBe('bulk')
    expect(order.shipping_address.subtotal).toBe(257)
  })

  test('stacks with FAMILY pricing', async () => {
    const { order } = await placeOrder({ items: [bpc(2)], affiliate_code: 'FAMILY', store_credit_code: 'BACK23-ABCDE' })
    expect(order.discount_amount).toBe(73) // 2 × 25 + 23
  })

  test('below the minimum → order refused with a clear message, code untouched', async () => {
    const { status, body } = await placeOrder({ items: [bpc(1)], store_credit_code: 'BACK23-ABCDE' })
    expect(status).toBe(400)
    expect(body.error).toMatch(/\$125 or more/)
    expect(CREDITS['BACK23-ABCDE'].redeemed_at).toBeNull()
  })

  test('someone else’s code → refused', async () => {
    const { status } = await placeOrder({ items: [bpc(2)], store_credit_code: 'BACK23-ABCDE', email: 'other@x.com' })
    expect(status).toBe(400)
  })

  test('code not switched on yet → refused', async () => {
    const { status, body } = await placeOrder({ items: [bpc(7)], store_credit_code: 'BACK94-ZZZZZ', email: 'rod@x.com' })
    expect(status).toBe(400)
    expect(body.error).toMatch(/isn’t active/)
  })

  test('second use → refused', async () => {
    await placeOrder({ items: [bpc(2)], store_credit_code: 'BACK23-ABCDE' })
    const { status, body } = await placeOrder({ items: [bpc(2)], store_credit_code: 'BACK23-ABCDE' })
    expect(status).toBe(400)
    expect(body.error).toMatch(/already been used/)
  })

  test('failed bank charge releases the code for another try', async () => {
    const { status } = await placeOrder({
      items: [bpc(2)], store_credit_code: 'BACK23-ABCDE', payment_method: 'lut_ach',
      extra: { lut_cart_id: 'c', lut_pay_token: 'p', lut_merchant_id: 'm' },
    })
    expect(status).toBe(402)
    expect(CREDITS['BACK23-ABCDE'].redeemed_at).toBeNull()
  })

  test('failed order save releases the code', async () => {
    insertError = { code: 'XX000', message: 'boom' }
    const { status } = await placeOrder({ items: [bpc(2)], store_credit_code: 'BACK23-ABCDE' })
    expect(status).toBe(500)
    expect(CREDITS['BACK23-ABCDE'].redeemed_at).toBeNull()
  })

  test('no credit code → order unchanged', async () => {
    const { order } = await placeOrder({ items: [bpc(2)] })
    expect(order.discount_amount).toBe(0)
    expect(order.shipping_address.store_credit_code).toBeUndefined()
  })
})
