// "Stacks well with" (product page) and "Commonly researched together" (cart).
//
// Pairings were drafted Oct 2026 and approved by Sean (see the Stacks Decision
// Tree workbook). Order matters: the first eligible pairing shows first.
//
// Rules, in order:
//   1. A lyophilized vial with no BAC Water in the cart → BAC Water first.
//   2. The product's own pairings, in order.
//   3. Never suggest something already in the cart, another size/format of
//      the same compound, or a single compound already inside a blend in the
//      cart (e.g. GLOW in cart → no BPC-157, TB-500 or GHK-Cu).
//   4. Never suggest anything out of stock, hidden (Lab), coming soon,
//      unpriced or prescription.
//   5. Cart with several products: rank candidates by how many cart items
//      list them; ties go to the earlier pairing slot.
//   6. Cart with BPC-157 10MG and TB-500 10MG → point to Wolverine Blend
//      10/10 (same compounds, one vial, lower price) instead.

import { PRODUCTS, getProductBySlug } from './products'

export const DILUENT_SLUG = 'bac-water-30ml'

export const PAIRINGS = {
  'bpc-157': ['tb-500', 'kpv-10mg', 'ghk-cu'],
  'tb-500': ['bpc-157', 'ghk-cu', 'kpv-10mg'],
  'wolverine-blend': ['ghk-cu', 'kpv-10mg', 'thymosin-alpha-1-10mg'],
  'wolverine-blend-5mg': ['ghk-cu', 'kpv-10mg', 'thymosin-alpha-1-10mg'],
  'glow-blend': ['kpv-10mg', 'thymosin-alpha-1-10mg', 'epithalon-40mg'],
  'klow-blend': ['thymosin-alpha-1-10mg', 'epithalon-40mg', 'nad-plus-1000mg'],
  'kgb-70mg': ['tb-500', 'thymosin-alpha-1-10mg', 'glutathione-1500mg'],
  'kpv-10mg': ['bpc-157', 'thymosin-alpha-1-10mg', 'ghk-cu'],
  'ghk-cu': ['bpc-157', 'epithalon-40mg', 'nad-plus-1000mg'],
  'thymosin-alpha-1-10mg': ['kpv-10mg', 'bpc-157', 'glutathione-1500mg'],
  'cjc1295nodac-ipamorelin': ['mots-c', 'nad-plus-1000mg', 'bpc-157'],
  'ipamorelin': ['tesamorelin', 'mots-c', 'nad-plus-1000mg'],
  'tesamorelin': ['ipamorelin', 'mots-c', '5-amino-1mq'],
  'tesamorelin-20mg': ['ipamorelin', 'mots-c', '5-amino-1mq'],
  'tesamorelin-ipamorelin-10mg-5mg': ['mots-c', '5-amino-1mq', 'nad-plus-1000mg'],
  'mots-c': ['nad-plus-1000mg', 'slu-pp-332-5mg-vial', '5-amino-1mq'],
  'mots-c-40mg': ['nad-plus-1000mg', 'slu-pp-332-5mg-vial', '5-amino-1mq'],
  'slu-pp-332': ['mots-c', '5-amino-1mq-capsules', 'nad-plus-1000mg'],
  'slu-pp-332-5mg-vial': ['mots-c', '5-amino-1mq', 'nad-plus-1000mg'],
  '5-amino-1mq': ['mots-c', 'slu-pp-332-5mg-vial', 'nad-plus-1000mg'],
  '5-amino-1mq-capsules': ['slu-pp-332', 'mots-c', 'nad-plus-1000mg'],
  'bam-15-50mg': ['mots-c', 'slu-pp-332-5mg-vial', '5-amino-1mq'],
  'nad-plus-1000mg': ['mots-c', 'epithalon-40mg', 'glutathione-1500mg'],
  'glutathione-1500mg': ['nad-plus-1000mg', 'ghk-cu', 'mots-c'],
  'epithalon-40mg': ['pinealon-20mg', 'nad-plus-1000mg', 'thymosin-alpha-1-10mg'],
  'epithalon-50mg': ['pinealon-20mg', 'nad-plus-1000mg', 'thymosin-alpha-1-10mg'],
  'pinealon-20mg': ['epithalon-40mg', 'nad-plus-1000mg', 'cartalax-20mg'],
  'cartalax-20mg': ['epithalon-40mg', 'pinealon-20mg', 'ghk-cu'],
  'bpc-157-500mcg-tablets': ['kpv-10mg', 'glutathione-1500mg', 'thymosin-alpha-1-10mg'],
  'bpc-157-kpv-500mcg-oral-capsules': ['glutathione-1500mg', 'thymosin-alpha-1-10mg', 'bpc-157'],
}

// Single compounds inside each blend.
export const BLEND_CONTENTS = {
  'wolverine-blend': ['bpc-157', 'tb-500'],
  'wolverine-blend-5mg': ['bpc-157', 'tb-500'],
  'glow-blend': ['bpc-157', 'tb-500', 'ghk-cu'],
  'klow-blend': ['bpc-157', 'tb-500', 'ghk-cu', 'kpv-10mg'],
  'kgb-70mg': ['bpc-157', 'kpv-10mg', 'ghk-cu'],
  'tesamorelin-ipamorelin-10mg-5mg': ['tesamorelin', 'tesamorelin-20mg', 'ipamorelin'],
  'cjc1295nodac-ipamorelin': ['ipamorelin'],
  'bpc-157-kpv-500mcg-oral-capsules': ['bpc-157-500mcg-tablets', 'kpv-10mg'],
}

// Same compound in another size or format (in addition to sizeGroup).
const EXTRA_FAMILIES = [
  ['slu-pp-332', 'slu-pp-332-5mg-vial'],
  ['bpc-157', 'bpc-157-500mcg-tablets'],
]

function familyOf(slug) {
  const p = getProductBySlug(slug)
  const fam = new Set([slug])
  if (p?.sizeGroup) PRODUCTS.filter(x => x.sizeGroup === p.sizeGroup).forEach(x => fam.add(x.slug))
  EXTRA_FAMILIES.forEach(f => { if (f.includes(slug)) f.forEach(s => fam.add(s)) })
  return fam
}

export function isSuggestable(p) {
  return !!p && p.inStock && !p.hidden && !p.comingSoon && Number(p.price) > 0 &&
    !p.prescription && p.category !== 'prescription'
}

export function isVial(p) {
  return !!p && (p.category === 'peptides' || p.category === 'blends') && !/tablet|capsule/i.test(p.name || '')
}

// Everything the cart already covers: items, their other sizes, and blend contents.
function coveredBy(slugs) {
  const covered = new Set()
  for (const s of slugs) {
    familyOf(s).forEach(x => covered.add(x))
    for (const c of BLEND_CONTENTS[s] || []) familyOf(c).forEach(x => covered.add(x))
  }
  return covered
}

const toCard = p => ({ slug: p.slug, name: p.name, price: p.price, image: p.image || null })

// Product page: up to `limit` suggestions for `slug`, given what's in the cart.
export function suggestForProduct(slug, cartSlugs = [], limit = 3) {
  const product = getProductBySlug(slug)
  if (!product) return []
  const inCart = new Set(cartSlugs)
  const covered = coveredBy([slug, ...cartSlugs])
  const out = []
  const add = s => {
    const p = getProductBySlug(s)
    if (out.length >= limit || !isSuggestable(p) || covered.has(s) || out.some(o => o.slug === s)) return
    out.push(toCard(p))
  }
  if (isVial(product) && !inCart.has(DILUENT_SLUG)) add(DILUENT_SLUG)
  ;(PAIRINGS[slug] || []).forEach(add)
  return out
}

// Cart: an upgrade hint (or null) plus up to `limit` add-on suggestions.
export function suggestForCart(cartSlugs = [], limit = 2) {
  const slugs = [...new Set(cartSlugs)]
  if (!slugs.length) return { upgrade: null, items: [] }
  const inCart = new Set(slugs)
  let upgrade = null
  const wolverine = getProductBySlug('wolverine-blend')
  if (inCart.has('bpc-157') && inCart.has('tb-500') && !inCart.has('wolverine-blend') && isSuggestable(wolverine)) {
    const separate = getProductBySlug('bpc-157').price + getProductBySlug('tb-500').price
    upgrade = { ...toCard(wolverine), separate, saves: Math.round((separate - wolverine.price) * 100) / 100 }
  }
  const covered = coveredBy(slugs)
  const score = new Map()
  slugs.forEach(s => (PAIRINGS[s] || []).forEach((c, idx) => {
    const prev = score.get(c) || { n: 0, best: 9 }
    score.set(c, { n: prev.n + 1, best: Math.min(prev.best, idx) })
  }))
  const ranked = [...score.entries()].sort((a, b) => b[1].n - a[1].n || a[1].best - b[1].best).map(([s]) => s)
  const needsDiluent = !inCart.has(DILUENT_SLUG) && slugs.some(s => isVial(getProductBySlug(s)))
  const order = needsDiluent ? [DILUENT_SLUG, ...ranked] : ranked
  const items = []
  for (const s of order) {
    const p = getProductBySlug(s)
    if (items.length >= limit) break
    if (!isSuggestable(p) || covered.has(s) || items.some(i => i.slug === s)) continue
    if (upgrade && (s === 'bpc-157' || s === 'tb-500')) continue
    items.push(toCard(p))
  }
  return { upgrade, items }
}
