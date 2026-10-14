import { NextResponse } from 'next/server'
import { createServerClient } from '../../../../lib/supabase'
import { getProductBySlug } from '../../../../lib/products'
import { normalizeCreditCode, evaluateStoreCredit } from '../../../../lib/storeCredit'

// POST /api/store-credit/preview
// body { code, email, line_items: [{ slug, quantity }] }
//
// Checks a store credit code for the checkout page. The orders API re-runs
// the same check (lib/storeCredit.js) and is the authority; this is only
// for showing the customer what they'll get.
//
// A code that doesn't exist and a code that belongs to a different email
// get the same answer, so this can't be used to discover codes.
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0
export const runtime = 'nodejs'

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function POST(request) {
  let body
  try { body = await request.json() } catch { return NextResponse.json({ valid: false, reason: 'bad_request' }, { status: 400, headers: NO_STORE }) }

  const code = normalizeCreditCode(body?.code)
  const email = String(body?.email || '').trim().toLowerCase()
  const line_items = Array.isArray(body?.line_items) ? body.line_items : []
  if (!code) return NextResponse.json({ valid: false, reason: 'missing_code' }, { headers: NO_STORE })
  if (!email) {
    return NextResponse.json({ valid: false, reason: 'missing_email', message: 'Enter your email above first — credit codes are tied to the email they were sent to.' }, { headers: NO_STORE })
  }

  // Product subtotal at catalog prices (client prices are never trusted).
  let subtotal = 0
  for (const li of line_items) {
    const p = li?.slug ? getProductBySlug(li.slug) : null
    if (!p) continue
    const qty = Math.max(1, Math.min(99, parseInt(li.quantity, 10) || 1))
    subtotal += Number(p.price || 0) * qty
  }

  try {
    const supabase = createServerClient()
    const { data: credit } = await supabase
      .from('store_credits')
      .select('code, customer_email, amount, min_order, active, expires_at, redeemed_at')
      .eq('code', code)
      .maybeSingle()

    const r = evaluateStoreCredit(credit, { email, subtotalBeforeDiscount: subtotal, subtotalAfterDiscount: subtotal })
    if (!r.ok) {
      return NextResponse.json({
        valid: false,
        reason: r.reason,
        message: r.message,
        // Amount and minimum are only revealed to the code's own email.
        ...(r.reason === 'below_minimum' ? { code, amount: r.amount, min_order: r.min_order, shortfall: r.shortfall } : {}),
      }, { headers: NO_STORE })
    }
    return NextResponse.json({
      valid: true,
      code,
      amount: r.face_amount,
      min_order: r.min_order,
      expires_at: credit.expires_at,
    }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ valid: false, reason: 'lookup_failed', message: 'Couldn’t check that code right now — please try again.' }, { status: 500, headers: NO_STORE })
  }
}
