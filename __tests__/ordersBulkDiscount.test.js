import { describe, test, expect, vi, beforeEach } from 'vitest'

// ── Mocks: everything outside the pricing logic ─────────────────────────
const AFFILIATES = {
  FRIENDS: { id: 'a1', code: 'FRIENDS', discount_pct: 0.1, discount_to_cost: false, discount_to_fixed_price: false, product_prices: null, email_whitelist: null },
  FAMILY: { id: 'a2', code: 'FAMILY', discount_pct: 0, discount_to_cost: false, discount_to_fixed_price: true, product_prices: { 'BPC-157': 45, 'TB-500': 45 }, email_whitelist: null },
  OWNERS: { id: 'a3', code: 'OWNERS', discount_pct: 0, discount_to_cost: false, discount_to_fixed_price: true, product_prices: { 'BPC-157': 25, 'TB-500': 25 }, email_whitelist: ['owner@x.com'] },
  PROMO10: { id: 'a4', code: 'PROMO10', discount_pct: 0.1, one_time_per_customer: true, affiliated_with: 'REP', email_whitelist: null },
  REP: { id: 'a5', code: 'REP', discount_pct: 0, linked_promo_code: 'PROMO10', email_whitelist: null },
}
let inserted = null
let upserts = []

function builder(table) {
  const q = { table, filters: {} }
  const self = {
    select: () => self, eq: (k, v) => { q.filters[k] = v; return self }, or: () => self,
    ilike: (k, v) => { q.filters[k] = String(v).toUpperCase(); return self },
    maybeSingle: async () => {
      if (table === 'affiliates') return { data: AFFILIATES[q.filters.code] || (q.filters.id ? Object.values(AFFILIATES).find(a => a.id === q.filters.id) : null) || null }
      return { data: null }
    },
    single: async () => ({ data: { id: 'order-1' }, error: null }),
    insert: (row) => { inserted = row; return self },
    upsert: async (row) => { upserts.push({ table, row }); return { data: null } },
    update: () => self,
    then: (resolve) => resolve({ data: null, error: null }),
  }
  return self
}

vi.mock('../lib/supabase', () => ({
  createServerClient: () => ({ from: (t) => builder(t) }),
  generateOrderNumber: async () => 'FA-TEST1',
}))
vi.mock('../lib/email', () => ({ sendOrderConfirmationEmail: vi.fn(async () => ({})), sendOrderReceivedAlert: vi.fn(async () => ({})) }))
vi.mock('../lib/quickbooks', () => ({ syncToQuickBooks: vi.fn(async () => ({})), checkInvoiceDocNumberExists: vi.fn(async () => false), getAccessToken: vi.fn(async () => 't'), fetchQboItems: vi.fn(async () => new Map()) }))
vi.mock('../lib/pushNotify', () => ({ broadcastOrderNotification: vi.fn(async () => ({})) }))
vi.mock('../lib/adminAuth', () => ({ requireAdmin: vi.fn() }))
vi.mock('../lib/labAuth', () => ({ verifyLabCookie: () => false }))
vi.mock('../lib/lut', () => ({ chargeLutTransaction: vi.fn() }))
vi.mock('../lib/trybe', () => ({ submitOrderToTrybe: vi.fn(async () => ({})), getTrybeVisitorId: () => null }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

const { POST } = await import('../app/api/orders/route.js')

async function placeOrder({ items, affiliate_code = null, promo_code = null, email = 'buyer@x.com' }) {
  inserted = null; upserts = []
  const req = new Request('http://x/api/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'Test Buyer', customer_email: email, customer_phone: '5555555555',
      shipping_address: { line1: '1 Main', city: 'Norman', state: 'OK', zip: '73069' },
      payment_method: 'venmo', shipping_method: 'fedex_2day', tax_rate: 0,
      line_items: items, affiliate_code, promo_code,
    }),
  })
  const res = await POST(req)
  return { status: res.status, order: inserted }
}

const bpc = q => ({ slug: 'bpc-157', quantity: q })   // $70
const tb = q => ({ slug: 'tb-500', quantity: q })     // $70

describe('orders API — multi-vial discount vs codes', () => {
  test('5 BPC-157, no code → 20% multi-vial ($70 off)', async () => {
    const { status, order } = await placeOrder({ items: [bpc(5)] })
    expect(status).toBe(200)
    expect(order.discount_amount).toBe(70)
    expect(order.total).toBe(280)
    expect(order.shipping_address.discount_source).toBe('bulk')
    expect(order.shipping_address.discount_label).toBe('Multi-vial discount')
  })

  test('10 BPC-157 → 30% ($210 off)', async () => {
    const { order } = await placeOrder({ items: [bpc(10)] })
    expect(order.discount_amount).toBe(210)
  })

  test('FRIENDS on a bulk order → multi-vial wins, FRIENDS dropped, affiliate still credited', async () => {
    const { order } = await placeOrder({ items: [bpc(5), tb(1)], affiliate_code: 'FRIENDS' })
    // FRIENDS would be 10% of 420 = 42; multi-vial = 70
    expect(order.discount_amount).toBe(70)
    expect(order.total).toBe(350)
    expect(order.affiliate_code).toBe('FRIENDS')
    expect(order.shipping_address.discount_source).toBe('bulk')
    expect(order.shipping_address.code_discount_declined).toBe(42)
  })

  test('FRIENDS on a non-bulk order → FRIENDS applies as before', async () => {
    const { order } = await placeOrder({ items: [bpc(2)], affiliate_code: 'FRIENDS' })
    expect(order.discount_amount).toBe(14)
    expect(order.shipping_address.discount_source).toBe('code')
    expect(order.shipping_address.discount_label).toBeUndefined()
  })

  test('FAMILY that saves more than multi-vial → FAMILY applies, never both', async () => {
    const { order } = await placeOrder({ items: [bpc(5)], affiliate_code: 'FAMILY' })
    // FAMILY: 5 × (70 − 45) = 125 > multi-vial 70
    expect(order.discount_amount).toBe(125)
    expect(order.shipping_address.discount_source).toBe('code')
  })

  test('OWNERS (whitelisted) keeps member pricing on a 10-vial order', async () => {
    const { order } = await placeOrder({ items: [bpc(10)], affiliate_code: 'OWNERS', email: 'owner@x.com' })
    expect(order.discount_amount).toBe(450) // 10 × (70 − 25)
    expect(order.shipping_address.discount_source).toBe('member')
  })

  test('linked one-time promo loses to multi-vial → not marked redeemed, attribution still locked', async () => {
    const { order } = await placeOrder({ items: [bpc(5)], affiliate_code: 'REP' })
    expect(order.discount_amount).toBe(70)
    expect(order.shipping_address.discount_source).toBe('bulk')
    expect(upserts.some(u => u.table === 'promo_code_redemptions')).toBe(false)
    expect(upserts.some(u => u.table === 'customer_affiliate_attribution' && u.row.affiliate_code === 'REP')).toBe(true)
  })

  test('linked one-time promo on a non-bulk order still redeems as before', async () => {
    const { order } = await placeOrder({ items: [bpc(1)], affiliate_code: 'REP' })
    expect(order.discount_amount).toBe(7)
    expect(upserts.some(u => u.table === 'promo_code_redemptions')).toBe(true)
  })

  test('free shipping still keyed off the pre-discount subtotal', async () => {
    const { order } = await placeOrder({ items: [{ slug: 'mots-c', quantity: 5 }] }) // $48 × 5 = 240 → under $250
    expect(order.shipping_address.shipping_amount).toBe(12)
    expect(order.discount_amount).toBe(48)
  })
})
