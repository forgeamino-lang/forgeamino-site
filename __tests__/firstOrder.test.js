import { describe, test, expect, vi } from 'vitest'
import { canCheckFirstOrder, firstOrderAmount, isFirstOrder } from '../lib/firstOrder.js'

describe('firstOrder helpers', () => {
  test('15% of the subtotal, rounded to cents', () => {
    expect(firstOrderAmount(140)).toBe(21)
    expect(firstOrderAmount(99.99)).toBe(15)
  })
  test('needs email + street + ZIP before checking', () => {
    expect(canCheckFirstOrder({ email: 'a@b.co', street: '1 Main St', zip: '73069' })).toBe(true)
    expect(canCheckFirstOrder({ email: 'a@b.co', street: '', zip: '73069' })).toBe(false)
    expect(canCheckFirstOrder({ email: 'a@b.co', street: '1 Main St', zip: '730' })).toBe(false)
    expect(canCheckFirstOrder({ email: 'nope', street: '1 Main St', zip: '73069' })).toBe(false)
  })
  test('isFirstOrder: true only when the database finds no prior order', async () => {
    const sb = r => ({ rpc: vi.fn(async () => r) })
    const args = { email: 'a@b.co', phone: '', street: '1 Main St', zip: '73069' }
    expect(await isFirstOrder(sb({ data: false, error: null }), args)).toBe(true)
    expect(await isFirstOrder(sb({ data: true, error: null }), args)).toBe(false)
    await expect(isFirstOrder(sb({ data: null, error: new Error('x') }), args)).rejects.toThrow()
    expect(await isFirstOrder(sb({ data: false, error: null }), { ...args, street: '' })).toBe(false)
  })
})
