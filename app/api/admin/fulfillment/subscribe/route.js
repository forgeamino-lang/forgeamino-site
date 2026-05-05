import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../../../lib/adminAuth'
import { createServerClient } from '../../../../../lib/supabase'

const ALLOWED_USERS = new Set(['Angela', 'Mark', 'Sean'])

export const dynamic = 'force-dynamic'

// POST /api/admin/fulfillment/subscribe
// Body: { user_name, subscription: { endpoint, keys: { p256dh, auth } }, user_agent? }
export async function POST(request) {
  const unauthorized = requireAdmin(request)
  if (unauthorized) return unauthorized

  let body
  try { body = await request.json() } catch { body = null }
  if (!body || !body.user_name || !body.subscription?.endpoint || !body.subscription?.keys?.p256dh || !body.subscription?.keys?.auth) {
    return NextResponse.json({ error: 'Body must be { user_name, subscription:{endpoint, keys:{p256dh, auth}} }' }, { status: 400 })
  }
  if (!ALLOWED_USERS.has(body.user_name)) {
    return NextResponse.json({ error: `user_name must be one of ${[...ALLOWED_USERS].join(', ')}` }, { status: 400 })
  }

  const supabase = createServerClient()
  // Upsert by endpoint (each browser/device has a unique endpoint)
  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_name:  body.user_name,
      endpoint:   body.subscription.endpoint,
      p256dh_key: body.subscription.keys.p256dh,
      auth_key:   body.subscription.keys.auth,
      user_agent: body.user_agent || null,
    }, { onConflict: 'endpoint' })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, id: data.id }, {
    headers: { 'Cache-Control': 'no-store' }
  })
}

// DELETE /api/admin/fulfillment/subscribe
// Body: { endpoint }
export async function DELETE(request) {
  const unauthorized = requireAdmin(request)
  if (unauthorized) return unauthorized

  let body
  try { body = await request.json() } catch { body = null }
  if (!body?.endpoint) {
    return NextResponse.json({ error: 'Body must include endpoint' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', body.endpoint)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true }, {
    headers: { 'Cache-Control': 'no-store' }
  })
}
