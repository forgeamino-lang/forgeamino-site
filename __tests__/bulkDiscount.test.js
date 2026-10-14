import { describe, test, expect } from 'vitest'
import { computeBulkDiscount, chooseDiscount, bulkTierFor, nextBulkTier, isBulkEligible } from '../lib/bulkDiscount.js'
import { getProductBySlug } from '../lib/products.js'

// Fixtures (lib/products.js):
//   bpc-157         $70  peptides      (eligible)
//   wolverine-blend $105 blends        (eligible)
//   bac-water-30ml  $30  supplies      (not eligible)
//   r               $195 lab, hidden   (not eligible)
//   rx-pt-141            prescription  (not eligible)

describe('tiers', () => {
  test('quantity thresholds', () => {
    expect(bulkTierFor(1)).toBeNull()
    expect(bulkTierFor(4)).toBeNull()
    expect(bulkTierFor(5).pct).toBe(0.2)
    expect(bulkTierFor(9).pct).toBe(0.2)
    expect(bulkTierFor(10).pct).toBe(0.3)
    expect(bulkTierFor(25).pct).toBe(0.3)
  })

  test('eligibility excludes supplies, Lab-only and prescription items', () => {
    expect(isBulkEligible(getProductBySlug('bpc-157'))).toBe(true)
    expect(isBulkEligible(getProductBySlug('bac-water-30ml'))).toBe(false)
    expect(isBulkEligible(getProductBySlug('r'))).toBe(false)
    expect(isBulkEligible(getProductBySlug('rx-pt-141'))).toBe(false)
    expect(isBulkEligible({ ...getProductBySlug('bpc-157'), bulkDiscount: false })).toBe(false)
  })
})

describe('computeBulkDiscount', () => {
  test('per-line: 5 BPC-157 = 20%, 10 Wolverine = 30%, singles and supplies untouched', () => {
    const r = computeBulkDiscount([
      { slug: 'bpc-157', price: 70, quantity: 5 },          // 350 * .2 = 70
      { slug: 'wolverine-blend', price: 105, quantity: 10 }, // 1050 * .3 = 315
      { slug: 'bpc-157-500mcg-tablets', price: 180, quantity: 1 },
      { slug: 'bac-water-30ml', price: 30, quantity: 6 },
    ])
    expect(r.discount_amount).toBe(385)
    expect(r.per_line.map(l => l.discount)).toEqual([70, 315, 0, 0])
  })

  test('mixing different products does not combine toward a tier', () => {
    const r = computeBulkDiscount([
      { slug: 'bpc-157', price: 70, quantity: 3 },
      { slug: 'wolverine-blend', price: 105, quantity: 2 },
    ])
    expect(r.discount_amount).toBe(0)
  })
})

describe('chooseDiscount (no stacking)', () => {
  test('FRIENDS 10% loses to multi-vial 20%', () => {
    expect(chooseDiscount({ bulkAmount: 70, codeAmount: 35 })).toBe('bulk')
  })
  test('FAMILY fixed pricing that saves more keeps FAMILY', () => {
    // 5 BPC-157: FAMILY $45 → $125 off; multi-vial 20% → $70 off
    expect(chooseDiscount({ bulkAmount: 70, codeAmount: 125 })).toBe('code')
  })
  test('tie goes to multi-vial', () => {
    expect(chooseDiscount({ bulkAmount: 70, codeAmount: 70 })).toBe('bulk')
  })
  test('member pricing (OWNERS) is exempt', () => {
    expect(chooseDiscount({ bulkAmount: 500, codeAmount: 200, memberPricing: true })).toBe('member')
  })
  test('no code, no bulk', () => {
    expect(chooseDiscount({ bulkAmount: 0, codeAmount: 0 })).toBe('none')
  })
  test('bulk only', () => {
    expect(chooseDiscount({ bulkAmount: 70, codeAmount: 0 })).toBe('bulk')
  })
})

describe('nextBulkTier nudges', () => {
  const bpc = getProductBySlug('bpc-157')
  test('3 in cart → 2 more for 20%', () => {
    expect(nextBulkTier(bpc, 3)).toMatchObject({ needed: 2, pct: 0.2 })
  })
  test('6 in cart → 4 more for 30%', () => {
    expect(nextBulkTier(bpc, 6)).toMatchObject({ needed: 4, pct: 0.3 })
  })
  test('10 in cart → no further tier', () => {
    expect(nextBulkTier(bpc, 10)).toBeNull()
  })
  test('ineligible product → no nudge', () => {
    expect(nextBulkTier(getProductBySlug('bac-water-30ml'), 1)).toBeNull()
  })
})
