import { describe, test, expect } from 'vitest'
import { isCodeLive, combineCodeDiscounts } from '../lib/promoCodes.js'
import { parseHolidayOffer } from '../lib/offers.js'

// HALLOWEEN25: Thu Oct 30 12:01am CDT through Sun Nov 1 11:59pm CST
// (DST ends Nov 1, so the start is UTC-5 and the end is UTC-6).
const H = { active: true, starts_at: '2026-10-30T05:01:00Z', expires_at: '2026-11-02T05:59:59Z' }

describe('sale code window', () => {
  test('dormant before 12:01am Oct 30 Central', () => {
    expect(isCodeLive(H, new Date('2026-10-30T05:00:59Z'))).toBe(false)
    expect(isCodeLive(H, new Date('2026-10-30T05:01:00Z'))).toBe(true)
  })
  test('live through 11:59pm Nov 1 Central, then off', () => {
    expect(isCodeLive(H, new Date('2026-11-02T05:59:00Z'))).toBe(true)
    expect(isCodeLive(H, new Date('2026-11-02T05:59:59Z'))).toBe(false)
  })
  test('switched off or empty rows are never live', () => {
    expect(isCodeLive({ ...H, active: false }, new Date('2026-10-31T12:00:00Z'))).toBe(false)
    expect(isCodeLive(null)).toBe(false)
    expect(isCodeLive({ active: true })).toBe(true)
  })
})

describe('code discounts never stack', () => {
  test('larger discount wins; ties go to the sale code', () => {
    expect(combineCodeDiscounts(10, 25)).toEqual({ amount: 25, source: 'promo' })
    expect(combineCodeDiscounts(40, 25)).toEqual({ amount: 40, source: 'affiliate' })
    expect(combineCodeDiscounts(25, 25)).toEqual({ amount: 25, source: 'promo' })
  })
  test('rep code with no discount + sale code = sale discount only', () => {
    expect(combineCodeDiscounts(0, 35.5)).toEqual({ amount: 35.5, source: 'promo' })
    expect(combineCodeDiscounts(0, 0)).toEqual({ amount: 0, source: 'none' })
  })
})

describe('halloween slide theme', () => {
  test('theme passes through; unknown themes fall back to the default sale look', () => {
    const now = new Date('2026-10-31T12:00:00Z')
    expect(parseHolidayOffer({ headline: 'x', theme: 'halloween' }, now).tone).toBe('halloween')
    expect(parseHolidayOffer({ headline: 'x', theme: 'nope' }, now).tone).toBe('sale')
    expect(parseHolidayOffer({ headline: 'x' }, now).tone).toBe('sale')
  })
})
