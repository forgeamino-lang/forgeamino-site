import { describe, test, expect } from 'vitest'
import { validateLineItems, computeOrderTotals } from '../lib/orderValidation.js'

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
    const totals = computeOrderTotals([{ price: 100, quantity: 1 }], undefined)
    expect(totals.tax_rate).toBe(0)
    expect(totals.tax_amount).toBe(0)
    expect(totals.total).toBe(100)
  })
})
