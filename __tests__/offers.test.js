import { describe, test, expect } from 'vitest'
import { standingOffers, parseHolidayOffer, buildOffers } from '../lib/offers.js'

describe('standing offers', () => {
  const s = standingOffers()
  test('four slides in the agreed order', () => {
    expect(s.map(x => x.id)).toEqual(['first-order', 'multi-vial', 'free-shipping', 'third-party-tested'])
  })
  test('numbers come from the checkout rules', () => {
    expect(s[0].headline).toBe('15% off your first order')
    expect(s[1].headline).toBe('Stock your lab. Save up to 30%.')
    expect(s[1].subline).toBe('BPC-157: $70 a vial → $56 at 5 → $49 at 10. Applied automatically.')
    expect(s[2].headline).toBe('Free FedEx 2-Day on orders $250+')
    expect(s[2].subline).toBe('Orders under $250 ship FedEx 2-Day for $12.')
  })
})

describe('holiday slide', () => {
  const now = new Date('2026-11-28T12:00:00Z')
  const base = { headline: 'Black Friday: 25% off', code: 'bf25', starts_at: '2026-11-27T06:00:00Z', ends_at: '2026-12-01T05:59:59Z' }
  test('live offer parses from JSON text and goes first', () => {
    const h = parseHolidayOffer(JSON.stringify(base), now)
    expect(h).toMatchObject({ id: 'holiday', code: 'BF25', cta: { label: 'Shop now', href: '/shop' } })
    expect(buildOffers(h)[0].id).toBe('holiday')
    expect(buildOffers(h)).toHaveLength(5)
  })
  test('not started, expired, switched off, or malformed → no slide', () => {
    expect(parseHolidayOffer(base, new Date('2026-11-20T00:00:00Z'))).toBeNull()
    expect(parseHolidayOffer(base, new Date('2026-12-02T00:00:00Z'))).toBeNull()
    expect(parseHolidayOffer({ ...base, active: false }, now)).toBeNull()
    expect(parseHolidayOffer('{not json', now)).toBeNull()
    expect(parseHolidayOffer({ subline: 'no headline' }, now)).toBeNull()
    expect(parseHolidayOffer(null, now)).toBeNull()
  })
  test('external links are not allowed', () => {
    expect(parseHolidayOffer({ headline: 'x', cta_href: 'https://evil.example' }, now).cta.href).toBe('/shop')
  })
  test('no holiday → four slides', () => {
    expect(buildOffers(null)).toHaveLength(4)
  })
})
