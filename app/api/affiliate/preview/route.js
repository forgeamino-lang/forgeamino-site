import { NextResponse } from 'next/server'
import { createServerClient } from '../../../../lib/supabase'
import { getAccessToken, fetchQboItems } from '../../../../lib/quickbooks'

// /api/affiliate/preview
//
// GET   ?code=X                                — returns metadata only (no discount calc)
//                                                Used for percent-based codes (FRIENDS, etc.) where
//                                                the client can compute the discount itself.
// POST  body { code, email?, line_items? }     — returns FULL preview including a server-computed
//                                                discount_amount for cost-based codes (OWNERS).
//                                                For cost-based codes, requires email + line_items.
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
    .select('code, name, discount_pct, discount_to_cost, email_whitelist, active')
    .ilike('code', code)
    .eq('active', true)
    .maybeSingle()
  return data
}

function isEmailAllowed(aff, email) {
  if (!aff?.email_whitelist || !Array.isArray(aff.email_whitelist) || aff.email_whitelist.length === 0) {
    return true   // no whitelist = open
  }
  const e = (email || '').trim().toLowerCase()
  if (!e) return false
  return aff.email_whitelist.map(s => s.toLowerCase()).includes(e)
}

async function computeCostDiscount(line_items) {
  // Sum line discounts where line_discount = qty * (price - cost), clamped to >=0.
  // Items without a positive cost contribute 0 (i.e., paid at retail).
  const realmId = process.env.QBO_REALM_ID
  if (!realmId) throw new Error('QBO_REALM_ID not set')
  const token = await getAccessToken()
  const itemsByName = await fetchQboItems(token, realmId)

  let total_discount = 0
  const per_line = []
  for (const li of (line_items || [])) {
    const name = li.qbo_name || li.name || ''
    const qboItem = itemsByName.get(name)
    const cost = Number(qboItem?.PurchaseCost || 0)
    const price = Number(li.price || 0)
    const qty   = Number(li.quantity || 0)
    const line_disc = cost > 0 ? Math.max(0, qty * (price - cost)) : 0
    total_discount += line_disc
    per_line.push({ name, qty, price, cost, line_discount: Number(line_disc.toFixed(2)) })
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
    // For cost-based codes, GET alone isn't sufficient — client should POST with cart + email.
    return NextResponse.json({
      valid: true,
      code: aff.code,
      name: aff.name,
      discount_pct: Number(aff.discount_pct || 0),
      requires_email_whitelist: Array.isArray(aff.email_whitelist) && aff.email_whitelist.length > 0,
      requires_cart_for_preview: !!aff.discount_to_cost,
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

    // Whitelist check (only matters when one is set)
    if (!isEmailAllowed(aff, email)) {
      // Silent rejection per product spec — code resolves as "no discount"
      return NextResponse.json({
        valid: true,
        code: aff.code,
        name: aff.name,
        discount_pct: 0,
        discount_amount: 0,
        whitelisted: false,
      }, { headers: { 'Cache-Control': 'no-store' } })
    }

    // Cost-based discount path
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

    // Percent-based code (existing behavior)
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
