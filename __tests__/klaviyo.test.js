import { describe, it, expect, vi } from 'vitest'
import { syncOrderToKlaviyo, buildPlacedOrderEvent, splitName } from '../lib/klaviyo'

const order = {
  order_number: 'FA-1001', customer_name: 'jane q doe', customer_email: ' Jane@Example.com ',
  total: 245.5, subtotal: 230, discount_amount: 0, shipping_amount: 0, tax_amount: 15.5,
  payment_method: 'zelle', affiliate_code: 'KARSTEN',
  line_items: [{ slug: 'bpc-157', name: 'BPC-157 10MG', price: 70, quantity: 2 }, { slug: 'bac-water-30ml', name: 'BAC Water', price: 30, quantity: 3 }],
}

describe('klaviyo sync', () => {
  it('skips without an API key', async () => {
    const f = vi.fn()
    expect(await syncOrderToKlaviyo(order, { env: {}, fetchImpl: f })).toEqual({ skipped: 'no api key' })
    expect(f).not.toHaveBeenCalled()
  })
  it('splits names', () => {
    expect(splitName('jane q doe')).toEqual({ first_name: 'Jane', last_name: 'Q Doe' })
    expect(splitName('')).toEqual({})
  })
  it('builds a Placed Order event', () => {
    const e = buildPlacedOrderEvent(order).data.attributes
    expect(e.metric.data.attributes.name).toBe('Placed Order')
    expect(e.unique_id).toBe('FA-1001')
    expect(e.value).toBe(245.5)
    expect(e.profile.data.attributes.email).toBe('jane@example.com')
    expect(e.properties.ItemCount).toBe(5)
    expect(e.properties.Items[0].RowTotal).toBe(140)
  })
  it('sends event, upserts profile, adds to list', async () => {
    const calls = []
    const f = vi.fn(async (url, opts) => { calls.push([url, JSON.parse(opts.body)]); return { ok: true, status: 200, json: async () => ({ data: { id: 'P1' } }) } })
    const r = await syncOrderToKlaviyo(order, { env: { KLAVIYO_PRIVATE_API_KEY: 'pk_x' }, fetchImpl: f })
    expect(r).toEqual({ event: true, list: true, profileId: 'P1' })
    expect(calls.map(c => c[0].replace('https://a.klaviyo.com/api', ''))).toEqual(['/events', '/profile-import', '/lists/XvptTV/relationships/profiles'])
    expect(calls[2][1]).toEqual({ data: [{ type: 'profile', id: 'P1' }] })
  })
  it('throws on API error so the caller can log it', async () => {
    const f = vi.fn(async () => ({ ok: false, status: 400, text: async () => 'bad' }))
    await expect(syncOrderToKlaviyo(order, { env: { KLAVIYO_PRIVATE_API_KEY: 'k' }, fetchImpl: f })).rejects.toThrow(/Klaviyo 400/)
  })
})
