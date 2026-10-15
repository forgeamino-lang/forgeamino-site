import { NextResponse } from 'next/server'
import { createServerClient } from '../../../../lib/supabase'
import { canCheckFirstOrder, isFirstOrder, FIRST_ORDER_PCT } from '../../../../lib/firstOrder'

// POST /api/first-order/check  body { email, phone, street, zip }
// Tells the checkout page whether the 15% first-order discount applies.
// The orders API runs the same check and is the authority.
// Answers only yes/no — never which detail matched an earlier order.
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0
export const runtime = 'nodejs'

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function POST(request) {
  let body
  try { body = await request.json() } catch { return NextResponse.json({ eligible: false }, { status: 400, headers: NO_STORE }) }
  const input = {
    email: String(body?.email || '').trim(),
    phone: String(body?.phone || '').trim(),
    street: String(body?.street || '').trim(),
    zip: String(body?.zip || '').trim(),
  }
  if (!canCheckFirstOrder(input)) return NextResponse.json({ eligible: false, checked: false }, { headers: NO_STORE })
  try {
    const eligible = await isFirstOrder(createServerClient(), input)
    return NextResponse.json({ eligible, checked: true, pct: FIRST_ORDER_PCT }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ eligible: false, checked: false }, { headers: NO_STORE })
  }
}
