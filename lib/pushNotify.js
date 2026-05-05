// Server-side web-push helper.
// Initialised lazily so the build doesn't fail when VAPID_* env vars are unset
// (eg local dev before Sean has configured them in Vercel).

import webpush from 'web-push'
import { createServerClient } from './supabase'

let configured = false
function ensureConfigured() {
  if (configured) return true
  const { VAPID_PUBLIC_KEY, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env
  const pub = NEXT_PUBLIC_VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY
  if (!pub || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    console.warn('[pushNotify] VAPID env vars not configured — push send skipped')
    return false
  }
  webpush.setVapidDetails(VAPID_SUBJECT, pub, VAPID_PRIVATE_KEY)
  configured = true
  return true
}

// Send a notification to every active push_subscription row.
// Failures (expired/invalid subscriptions) are pruned automatically.
export async function broadcastOrderNotification(order) {
  if (!ensureConfigured()) return { ok: false, reason: 'not-configured' }

  const supabase = createServerClient()
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, user_name, endpoint, p256dh_key, auth_key')
  if (error) {
    console.error('[pushNotify] failed to load subscriptions:', error.message)
    return { ok: false, reason: 'db-error', error: error.message }
  }
  if (!subs || subs.length === 0) return { ok: true, sent: 0, reason: 'no-subscribers' }

  // Build the payload the service worker's `push` handler expects
  const total = Number(order.total ?? 0)
  const payload = JSON.stringify({
    title: `New Order — ${order.order_number}`,
    body:  `${order.customer_name || 'Customer'}  ·  $${total.toFixed(2)}`,
    tag:   `order-${order.order_number}`,
    url:   '/admin/fulfillment',
  })

  const results = await Promise.allSettled(
    subs.map(s => webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh_key, auth: s.auth_key } },
      payload
    ))
  )

  // Prune subscriptions that have permanently failed (404/410 endpoint gone)
  const expiredIds = []
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const code = r.reason?.statusCode
      if (code === 404 || code === 410) expiredIds.push(subs[i].id)
      else console.warn('[pushNotify] send failed:', code, r.reason?.body || r.reason?.message)
    }
  })
  if (expiredIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expiredIds)
  }

  const sent     = results.filter(r => r.status === 'fulfilled').length
  const failed   = results.length - sent
  console.log(`[pushNotify] order ${order.order_number}: ${sent} sent / ${failed} failed / ${expiredIds.length} pruned`)
  return { ok: true, sent, failed, pruned: expiredIds.length }
}
