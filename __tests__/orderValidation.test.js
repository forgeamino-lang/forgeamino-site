import { describe, test, expect } from 'vitest'
import { validateLineItems, computeOrderTotals } from '../lib/orderValidation.js'
import { computeShipping, FREE_SHIPPING_THRESHOLD, FEDEX_2DAY_COST } from '../lib/shipping.js'

// Fixture slugs used below must match lib/products.js:
//   id=19  slug='hgh-191aa-10iu-x-10-vials'  price=$220  category='peptides'  (public)
//   id=20  slug='r'                          price=$195  category='lab'       (hidden)
//   qbo_name of id=20 is 'GLP3-R 20mg'

describe('validateLineItems', () => {
  test('valid public product passes and uses catalog price (not client price)', () => {
    const r = validateLineItems(
      [{ slug: 'hgh-191aa-10iu-x-10-vials', quantity: 1, price: 999 }],
      { hasLabAccess: false }
    )
    expect(r.ok).toBe(true)
    expect(r.validated).toHaveLength(1)
    expect(r.validated[0].price).toBe(220)        // catalog, not 999
    expect(r.validated[0].slug).toBe('hgh-191aa-10iu-x-10-vials')
    expect(r.validated[0].qbo_name).toBe('HGH 191AA (10IU x 10 Vials)')
  })

  test('hidden Lab product without lab cookie returns 401', () => {
    const r = validateLineItems(
      [{ slug: 'r', quantity: 1 }],
      { hasLabAccess: false }
    )
    expect(r.ok).toBe(false)
    expect(r.status).toBe(401)
    expect(r.error).toMatch(/access denied/i)
  })

  test('hidden Lab product WITH lab access passes and enriches qbo_name', () => {
    const r = validateLineItems(
      [{ slug: 'r', quantity: 2, price: 0.01 }],
      { hasLabAccess: true }
    )
    expect(r.ok).toBe(true)
    expect(r.validated[0].price).toBe(195)        // catalog, not 0.01
    expect(r.validated[0].qbo_name).toBe('GLP3-R 20mg')
    expect(r.validated[0].quantity).toBe(2)
  })

  test('tampered client price is always overridden by server catalog price', () => {
    const r = validateLineItems(
      [{ slug: 'hgh-191aa-10iu-x-10-vials', quantity: 1, price: 1 }],
      { hasLabAccess: false }
    )
    expect(r.ok).toBe(true)
    expect(r.validated[0].price).toBe(220)        // not 1
  })

  test('unknown slug returns 400', () => {
    const r = validateLineItems(
      [{ slug: 'definitely-not-a-product', quantity: 1 }],
      { hasLabAccess: true }
    )
    expect(r.ok).toBe(false)
    expect(r.status).toBe(400)
  })

  test('empty line_items returns 400', () => {
    const r = validateLineItems([], { hasLabAccess: false })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(400)
  })
})

describe('computeOrderTotals', () => {
  test('subtotal = sum(price * qty); tax = subtotal * rate; total = subtotal + tax', () => {
    const validated = [{ price: 195, quantity: 2 }]
    const totals = computeOrderTotals(validated, 0.08)
    expect(totals.subtotal).toBe(390)
    expect(totals.tax_amount).toBe(31.2)
    expect(totals.total).toBe(421.2)
    expect(totals.tax_rate).toBe(0.08)
  })

  test('missing/invalid tax_rate is treated as 0', () => {
    // subtotal 100 < $250 → default FedEx 2-Day adds $12 shipping → total $112
    const totals = computeOrderTotals([{ price: 100, quantity: 1 }], undefined)
    expect(totals.tax_rate).toBe(0)
    expect(totals.tax_amount).toBe(0)
    expect(totals.shipping_method).toBe('fedex_2day')
    expect(totals.shipping_amount).toBe(12)
    expect(totals.total).toBe(112)
  })
})

describe('computeShipping', () => {
  test('fedex_2day under threshold costs $12', () => {
    expect(computeShipping(100, 'fedex_2day')).toBe(FEDEX_2DAY_COST)
  })

  test('fedex_2day at exactly $250 is free', () => {
    expect(computeShipping(FREE_SHIPPING_THRESHOLD, 'fedex_2day')).toBe(0)
  })

  test('fedex_2day over threshold is free', () => {
    expect(computeShipping(999, 'fedex_2day')).toBe(0)
  })

  test('local_delivery is always $0 regardless of subtotal', () => {
    expect(computeShipping(0, 'local_delivery')).toBe(0)
    expect(computeShipping(50, 'local_delivery')).toBe(0)
    expect(computeShipping(500, 'local_delivery')).toBe(0)
  })

  test('unknown method falls through to fedex_2day', () => {
    expect(computeShipping(50, 'pigeon_mail')).toBe(FEDEX_2DAY_COST)
    expect(computeShipping(500, undefined)).toBe(0)
  })
})

describe('computeOrderTotals shipping interactions', () => {
  test('subtotal 390 + fedex_2day → free shipping, tax on subtotal only', () => {
    const totals = computeOrderTotals([{ price: 195, quantity: 2 }], 0.08, 'fedex_2day')
    expect(totals.subtotal).toBe(390)
    expect(totals.tax_amount).toBe(31.2)        // tax on subtotal, not subtotal+shipping
    expect(totals.shipping_amount).toBe(0)
    expect(totals.total).toBe(421.2)
  })

  test('subtotal 100 + local_delivery → $0 shipping even under threshold', () => {
    const totals = computeOrderTotals([{ price: 100, quantity: 1 }], 0.08, 'local_delivery')
    expect(totals.shipping_method).toBe('local_delivery')
    expect(totals.shipping_amount).toBe(0)
    expect(totals.tax_amount).toBe(8)
    expect(totals.total).toBe(108)
  })

  test('subtotal 50 + fedex_2day → $12 shipping, tax base stays $50', () => {
    const totals = computeOrderTotals([{ price: 50, quantity: 1 }], 0.10, 'fedex_2day')
    expect(totals.subtotal).toBe(50)
    expect(totals.tax_amount).toBe(5)           // 10% of 50, not 10% of 62
    expect(totals.shipping_amount).toBe(12)
    expect(totals.total).toBe(67)               // 50 + 5 + 12
  })
})
