import { describe, test, expect } from 'vitest'
import { PAIRINGS, BLEND_CONTENTS, suggestForProduct, suggestForCart, isVial } from '../lib/pairings.js'
import { getProductBySlug } from '../lib/products.js'

const slugs = list => list.map(x => x.slug)

describe('pairings data', () => {
  test('every product and suggestion slug exists in the catalog', () => {
    for (const [k, v] of Object.entries(PAIRINGS)) {
      expect(getProductBySlug(k), k).toBeTruthy()
      v.forEach(s => expect(getProductBySlug(s), `${k} → ${s}`).toBeTruthy())
    }
    for (const [k, v] of Object.entries(BLEND_CONTENTS)) {
      expect(getProductBySlug(k), k).toBeTruthy()
      v.forEach(s => expect(getProductBySlug(s), `${k} ⊃ ${s}`).toBeTruthy())
    }
  })
})

describe('product page', () => {
  test('vial with empty cart → BAC Water first, then pairings', () => {
    expect(slugs(suggestForProduct('bpc-157', []))).toEqual(['bac-water-30ml', 'tb-500', 'kpv-10mg'])
  })
  test('BAC Water already in cart → three pairings', () => {
    expect(slugs(suggestForProduct('bpc-157', ['bac-water-30ml']))).toEqual(['tb-500', 'kpv-10mg', 'ghk-cu'])
  })
  test('tablets never trigger BAC Water', () => {
    expect(isVial(getProductBySlug('bpc-157-500mcg-tablets'))).toBe(false)
    expect(slugs(suggestForProduct('bpc-157-500mcg-tablets', []))).not.toContain('bac-water-30ml')
  })
  test('skips items in cart and compounds already inside a blend in cart', () => {
    const s = slugs(suggestForProduct('kpv-10mg', ['bac-water-30ml', 'glow-blend']))
    expect(s).not.toContain('bpc-157')
    expect(s).not.toContain('ghk-cu')
    expect(s).toContain('thymosin-alpha-1-10mg')
  })
  test('never suggests another size of the same compound', () => {
    expect(slugs(suggestForProduct('mots-c', ['bac-water-30ml']))).not.toContain('mots-c-40mg')
    expect(slugs(suggestForProduct('ghk-cu', ['bac-water-30ml', 'epithalon-50mg']))).not.toContain('epithalon-40mg')
  })
  test('blend page never suggests its own ingredients', () => {
    expect(slugs(suggestForProduct('glow-blend', []))).not.toEqual(expect.arrayContaining(['bpc-157']))
  })
  test('unknown product → nothing', () => { expect(suggestForProduct('nope', [])).toEqual([]) })
})

describe('cart', () => {
  test('vial in cart without diluent → BAC Water first', () => {
    expect(slugs(suggestForCart(['mots-c']).items)).toEqual(['bac-water-30ml', 'nad-plus-1000mg'])
  })
  test('ranks what several cart items have in common', () => {
    // mots-c and 5-amino-1mq both list nad-plus-1000mg
    expect(slugs(suggestForCart(['bac-water-30ml', 'mots-c', '5-amino-1mq']).items)[0]).toBe('nad-plus-1000mg')
  })
  test('BPC-157 + TB-500 → Wolverine upgrade, and neither is re-suggested', () => {
    const r = suggestForCart(['bac-water-30ml', 'bpc-157', 'tb-500'])
    expect(r.upgrade).toMatchObject({ slug: 'wolverine-blend', separate: 140, saves: 35 })
    expect(slugs(r.items)).not.toContain('bpc-157')
  })
  test('empty cart → nothing', () => { expect(suggestForCart([])).toEqual({ upgrade: null, items: [] }) })
})
