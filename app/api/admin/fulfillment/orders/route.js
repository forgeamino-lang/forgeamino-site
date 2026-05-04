import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../../../lib/adminAuth'
import { createServerClient } from '../../../../../lib/supabase'

// GET /api/admin/fulfillment/orders?key=ADMIN_PASSWORD&since=YYYY-MM-DD
// Returns orders for the fulfillment workflow page. Defaults to the last 60 days
// to keep payload small; older orders generally don't need active fulfillment.
export const dynamic = 'force-dynamic'

export async function GET(request) {
  const unauthorized = requireAdmin(request)
  if (unauthorized) return unauthorized

  const url = new URL(request.url)
  const since =
    url.searchParams.get('since') ||
    new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString().slice(0, 10)

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('orders')
    .select(
      `id, order_number, created_at, customer_name, customer_phone, customer_email,
       shipping_address, line_items, total,
       payment_method, payment_status, fulfillment_status, tracking_number,
       affiliate_code, claimed_by, claimed_at, shipped_at, delivered_at`
    )
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ orders: data, fetched_at: new Date().toISOString() })
}
