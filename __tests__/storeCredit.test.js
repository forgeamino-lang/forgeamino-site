import { describe, test, expect } from 'vitest'
import { evaluateStoreCredit, normalizeCreditCode, looksLikeCreditCode, discountBreakdown } from '../lib/storeCredit.js'

const NOW = new Date('2026-11-01T12:00:00Z')
const credit = (over = {}) => ({
  code: 'BACK23-ABCDE', customer_email: 'jane@x.com', amount: 23, min_order: 125,
  active: true, expires_at: '2026-11-20T05:59:59Z', redeemed_at: null, ...over,
})
const ev = (c, o = {}) => evaluateStoreCredit(c, { email: 'jane@x.com', subtotalBeforeDiscount: 140, subtotalAfterDiscount: 140, now: NOW, ...o })

describe('evaluateStoreCredit', () => {
  test('valid credit on a qualifying order', () => {
    expect(ev(credit())).toMatchObject({ ok: true, amount: 23, min_order: 125 })
  })
  test('email match is case-insensitive', () => {
    expect(ev(credit(), { email: '  Jane@X.com ' }).ok).toBe(true)
  })
  test('unknown code and wrong email give the same answer', () => {
    const a = ev(null), b = ev(credit(), { email: 'someone@else.com' })
    expect(a.ok).toBe(false); expect(b.ok).toBe(false)
    expect(a.message).toBe(b.message)
  })
  test('switched off (not sent yet)', () => {
    expect(ev(credit({ active: false })).reason).toBe('inactive')
  })
  test('expired', () => {
    expect(ev(credit({ expires_at: '2026-10-31T00:00:00Z' })).reason).toBe('expired')
  })
  test('already used', () => {
    expect(ev(credit({ redeemed_at: '2026-10-30T00:00:00Z' })).reason).toBe('redeemed')
  })
  test('minimum is checked on the subtotal BEFORE discounts', () => {
    // $140 cart with FRIENDS (−$14) → $126 after: still qualifies on $140
    expect(ev(credit(), { subtotalAfterDiscount: 126 })).toMatchObject({ ok: true, amount: 23 })
    const r = ev(credit(), { subtotalBeforeDiscount: 120, subtotalAfterDiscount: 120 })
    expect(r).toMatchObject({ ok: false, reason: 'below_minimum', shortfall: 5 })
  })
  test('never takes the subtotal below $0', () => {
    expect(ev(credit({ min_order: 0, amount: 94 }), { subtotalAfterDiscount: 50 }).amount).toBe(50)
  })
})

describe('code helpers', () => {
  test('normalize', () => expect(normalizeCreditCode(' back23-abcde ')).toBe('BACK23-ABCDE'))
  test('looksLikeCreditCode', () => {
    expect(looksLikeCreditCode('back94-te9ab')).toBe(true)
    expect(looksLikeCreditCode('FRIENDS')).toBe(false)
  })
})

describe('discountBreakdown (email + QuickBooks)', () => {
  test('splits code discount from store credit', () => {
    const d = discountBreakdown({ discount_amount: 37, shipping_address: { store_credit_amount: 23, store_credit_code: 'BACK23-ABCDE' } })
    expect(d).toEqual({ total: 37, credit: 23, creditCode: 'BACK23-ABCDE', other: 14 })
  })
  test('orders without a credit are unchanged', () => {
    expect(discountBreakdown({ discount_amount: 14, shipping_address: {} })).toMatchObject({ credit: 0, other: 14 })
  })
})
