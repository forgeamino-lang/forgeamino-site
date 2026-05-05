import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../../../lib/adminAuth'
import { createServerClient } from '../../../../../lib/supabase'

// GET /api/admin/fulfillment/orders?key=ADMIN_PASSWORD
//   ?month=YYYY-MM   filter to that calendar month (preferred)
//   ?since=YYYY-MM-DD legacy: orders >= this date
//   default          current month
export const dynamic       = 'force-dynamic'
export const fetchCache    = 'force-no-store'   // Next.js data cache off
export const revalidate    = 0                  // never reuse a render
export const runtime       = 'nodejs'           // explicit; avoids edge cache differences

function monthBounds(yyyymm) {
  // Return [startISO, endISO) for a YYYY-MM string
  const [y, m] = yyyymm.split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) return null
  const start = new Date(Date.UTC(y, m - 1, 1)).toISOString()
  const end   = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1)).toISOString()
  return [start, end]
}

export async function GET(request) {
  const unauthorized = requireAdmin(request)
  if (unauthorized) return unauthorized

  const url = new URL(request.url)
  const monthParam = url.searchParams.get('month')
  const sinceParam = url.searchParams.get('since')

  // Default to current month (UTC) if neither is provided
  const defaultMonth = new Date().toISOString().slice(0, 7)
  const month = monthParam || (sinceParam ? null : defaultMonth)

  const supabase = createServerClient()
  // Cache-buster — append a no-op filter whose value changes every call so
  // any HTTP-cache layer between us and PostgREST (Supabase's API gateway,
  // any CDN, etc.) sees a unique URL and can't serve a stale response.
  const _cacheBust = Date.now().toString(36) + Math.random().toString(36).slice(2)
  let query = supabase
    .from('orders')
    .select(
      `id, order_number, created_at, customer_name, customer_phone, customer_email,
       shipping_address, line_items, total,
       payment_method, payment_status, fulfillment_status, tracking_number,
       affiliate_code, claimed_by, claimed_at, shipped_at, delivered_at`
    )
    .order('created_at', { ascending: false })
    .neq('id', '00000000-0000-0000-0000-' + _cacheBust.slice(0, 12).padEnd(12, '0'))

  if (month) {
    const bounds = monthBounds(month)
    if (!bounds) {
      return NextResponse.json({ error: `Invalid month: ${month}` }, { status: 400 })
    }
    query = query.gte('created_at', bounds[0]).lt('created_at', bounds[1])
  } else if (sinceParam) {
    query = query.gte('created_at', sinceParam)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  // Aggressive no-cache so the Vercel edge CDN never serves a stale snapshot
  // back to the client. Without this, peers' edits could appear to "revert"
  // because polling reads a cached pre-edit body.
  return NextResponse.json(
    { orders: data, fetched_at: new Date().toISOString(), month, since: sinceParam || null },
    { headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'CDN-Cache-Control': 'no-store',
      'Vercel-CDN-Cache-Control': 'no-store',
      'Pragma': 'no-cache',
      'Expires': '0',
    }}
  )
}
