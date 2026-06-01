import { NextResponse } from 'next/server'
import { createServerClient } from '../../../../lib/supabase'
import { getAccessToken, fetchQboItems } from '../../../../lib/quickbooks'
import { getProductBySlug } from '../../../../lib/products'

// /api/affiliate/preview
//
// GET ?code=X — returns metadata only (no discount calc)
// Used for percent-based codes (FRIENDS, etc.) where
// the client can compute the discount itself.
// POST body { code, email?, line_items? } — returns FULL preview including a server-computed
// discount_amount for cost-based codes (OWNERS) or fixed-price codes (FAMILY).
// For cost-based and fixed-price codes, requires email + line_items.
//
// Never reveals the full affiliates table or per-product costs to the client.
// For cost-based codes, only the resulting total dollar discount is returned.
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0
export const runtime = 'nodejs'
export const maxDuration = 30

async function lookupAffiliate(code) {
const supabase = createServerClient()
const { data } = await supabase
.from('affiliates')
.select('code, name, discount_pct, discount_to_cost, discount_to_fixed_price, product_prices, email_whitelist, active, max_uses')
.ilike('code', code)
.eq('active', true)
.maybeSingle()
return data
}

// Returns true if this code has hit its max_uses limit.
// max_uses = null means unlimited.
async function isExhausted(aff) {
if (aff.max_uses == null) return false
const supabase = createServerClient()
const { count } = await supabase
.from('orders')
.select('id', { count: 'exact', head: true })
.ilike('affiliate_code', aff.code)
return (count || 0) >= aff.max_uses
}

function isEmailAllowed(aff, email) {
if (!aff?.email_whitelist || !Array.isArray(aff.email_whitelist) || aff.email_whitelist.length === 0) {
return true // no whitelist = open
}
const e = (email || '').trim().toLowerCase()
if (!e) return false
return aff.email_whitelist.map(s => s.toLowerCase()).includes(e)
}

async function computeCostDiscount(line_items) {
const realmId = process.env.QBO_REALM_ID
if (!realmId) throw new Error('QBO_REALM_ID not set')
const token = await getAccessToken()
const itemsByName = await fetchQboItems(token, realmId)

let total_discount = 0
const per_line = []
for (const li of (line_items || [])) {
const cat = li.slug ? getProductBySlug(li.slug) : null
const lookupName = (cat && (cat.qbo_name || cat.name)) || li.qbo_name || li.name || ''
const qboItem = itemsByName.get(lookupName)
const cost = Number(qboItem?.PurchaseCost || 0)
const price = Number(cat?.price ?? li.price ?? 0)
const qty = Number(li.quantity || 0)
const line_disc = cost > 0 ? Math.max(0, qty * (price - cost)) : 0
total_discount += line_disc
per_line.push({ name: lookupName, qty, price, cost, line_discount: Number(line_disc.toFixed(2)) })
}
return { discount_amount: Number(total_discount.toFixed(2)), per_line }
}

function computeFixedPriceDiscount(line_items, product_prices) {
let total_discount = 0
const per_line = []
for (const li of (line_items || [])) {
const cat = li.slug ? getProductBySlug(li.slug) : null
const lookupName = (cat && (cat.qbo_name || cat.name)) || li.qbo_name || li.name || ''
const fixed = Number(product_prices?.[lookupName])
const retail = Number(cat?.price ?? li.price ?? 0)
const qty = Number(li.quantity || 0)
const line_disc = (Number.isFinite(fixed) && fixed >= 0 && fixed < retail)
? qty * (retail - fixed)
: 0
total_discount += line_disc
per_line.push({ name: lookupName, qty, retail, fixed, line_discount: Number(line_disc.toFixed(2)) })
}
return { discount_amount: Number(total_discount.toFixed(2)), per_line }
}

export async function GET(request) {
const url = new URL(request.url)
const code = (url.searchParams.get('code') || '').trim()
if (!code) return NextResponse.json({ valid: false }, { headers: { 'Cache-Control': 'no-store' } })
try {
const aff = await lookupAffiliate(code)
if (!aff) return NextResponse.json({ valid: false }, { headers: { 'Cache-Control': 'no-store' } })
if (await isExhausted(aff)) return NextResponse.json({ valid: false, error: 'code_exhausted' }, { headers: { 'Cache-Control': 'no-store' } })
return NextResponse.json({
valid: true,
code: aff.code,
name: aff.name,
discount_pct: Number(aff.discount_pct || 0),
requires_email_whitelist: Array.isArray(aff.email_whitelist) && aff.email_whitelist.length > 0,
requires_cart_for_preview: !!(aff.discount_to_cost || aff.discount_to_fixed_price),
}, { headers: { 'Cache-Control': 'no-store' } })
} catch {
return NextResponse.json({ valid: false, error: 'lookup_failed' }, { status: 500 })
}
}

export async function POST(request) {
let body
try { body = await request.json() } catch { return NextResponse.json({ valid: false, error: 'bad_request' }, { status: 400 }) }
const code = (body?.code || '').trim()
const email = (body?.email || '').trim().toLowerCase()
const line_items = Array.isArray(body?.line_items) ? body.line_items : []
if (!code) return NextResponse.json({ valid: false })

try {
const aff = await lookupAffiliate(code)
if (!aff) return NextResponse.json({ valid: false })

if (await isExhausted(aff)) return NextResponse.json({ valid: false, error: 'code_exhausted' }, { headers: { 'Cache-Control': 'no-store' } })

if (!isEmailAllowed(aff, email)) {
return NextResponse.json({
valid: true,
code: aff.code,
name: aff.name,
discount_pct: 0,
discount_amount: 0,
whitelisted: false,
}, { headers: { 'Cache-Control': 'no-store' } })
}

if (aff.discount_to_cost) {
if (!line_items.length) {
return NextResponse.json({
valid: true,
code: aff.code,
name: aff.name,
requires_cart_for_preview: true,
discount_amount: 0,
})
}
const { discount_amount } = await computeCostDiscount(line_items)
return NextResponse.json({
valid: true,
code: aff.code,
name: aff.name,
discount_to_cost: true,
discount_amount,
whitelisted: true,
}, { headers: { 'Cache-Control': 'no-store' } })
}

if (aff.discount_to_fixed_price) {
if (!line_items.length || !aff.product_prices) {
return NextResponse.json({
valid: true,
code: aff.code,
name: aff.name,
requires_cart_for_preview: true,
discount_amount: 0,
})
}
const { discount_amount } = computeFixedPriceDiscount(line_items, aff.product_prices)
return NextResponse.json({
valid: true,
code: aff.code,
name: aff.name,
discount_to_fixed_price: true,
discount_amount,
whitelisted: true,
}, { headers: { 'Cache-Control': 'no-store' } })
}

return NextResponse.json({
valid: true,
code: aff.code,
name: aff.name,
discount_pct: Number(aff.discount_pct || 0),
whitelisted: true,
}, { headers: { 'Cache-Control': 'no-store' } })
} catch (e) {
return NextResponse.json({ valid: false, error: 'lookup_failed' }, { status: 500 })
}
}
