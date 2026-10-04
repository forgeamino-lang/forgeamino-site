import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../../../lib/adminAuth'
import { createServerClient } from '../../../../../lib/supabase'
import { sendPaymentConfirmedEmail } from '../../../../../lib/email'

// PATCH /api/admin/fulfillment/update?key=ADMIN_PASSWORD
// Body: { id, payment_status?, claimed_by?, fulfillment_status?, tracking_number?, notes? }
//
// Whitelist what columns can be patched, and auto-stamp the *_at timestamps when
// the matching status field flips. This is the only write the UI does to orders.
export const dynamic = 'force-dynamic'

const ALLOWED_PAYMENT  = new Set(['pending', 'paid', 'failed'])
const ALLOWED_CLAIM    = new Set(['Angela', 'Mark', 'Sean', 'Amy', null, ''])
const ALLOWED_FULFIL   = new Set(['pending', 'processing', 'shipped', 'delivered'])

export async function PATCH(request) {
  const unauthorized = requireAdmin(request)
  if (unauthorized) return unauthorized

  let body
  try { body = await request.json() } catch { body = null }
  if (!body || typeof body !== 'object' || !body.id) {
    return NextResponse.json({ error: 'Body must be { id, ...patch }' }, { status: 400 })
  }
  const { id, payment_status, claimed_by, fulfillment_status, tracking_number, notes } = body

  const patch = {}
  const now = new Date().toISOString()

  if (payment_status !== undefined) {
    if (!ALLOWED_PAYMENT.has(payment_status)) {
      return NextResponse.json({ error: `Invalid payment_status: ${payment_status}` }, { status: 400 })
    }
    patch.payment_status = payment_status
  }
  if (claimed_by !== undefined) {
    const normalized = claimed_by === '' ? null : claimed_by
    if (!ALLOWED_CLAIM.has(normalized)) {
      return NextResponse.json({ error: `Invalid claimed_by: ${claimed_by}` }, { status: 400 })
    }
    patch.claimed_by = normalized
    if (normalized) patch.claimed_at = now
    else patch.claimed_at = null
  }
  if (fulfillment_status !== undefined) {
    if (!ALLOWED_FULFIL.has(fulfillment_status)) {
      return NextResponse.json({ error: `Invalid fulfillment_status: ${fulfillment_status}` }, { status: 400 })
    }
    patch.fulfillment_status = fulfillment_status
    if (fulfillment_status === 'shipped')   patch.shipped_at   = now
    if (fulfillment_status === 'delivered') patch.delivered_at = now
  }
  if (tracking_number !== undefined) {
    patch.tracking_number = tracking_number === '' ? null : String(tracking_number).trim()
  }
  if (notes !== undefined) {
    // Allow empty string -> null clear. Cap length at 2000 chars to keep rows sane.
    if (notes === null || notes === '') {
      patch.notes = null
    } else if (typeof notes === 'string') {
      patch.notes = notes.length > 2000 ? notes.slice(0, 2000) : notes
    } else {
      return NextResponse.json({ error: 'notes must be a string' }, { status: 400 })
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const supabase = createServerClient()

  // Read the prior payment status so the payment-confirmed email only fires on
  // a real transition to 'paid' (re-selecting 'paid' must not re-email).
  let prevPaymentStatus = null
  if (payment_status === 'paid') {
    const { data: prev } = await supabase
      .from('orders')
      .select('payment_status')
      .eq('id', id)
      .single()
    prevPaymentStatus = prev?.payment_status ?? null
  }

  const { data, error } = await supabase
    .from('orders')
    .update(patch)
    .eq('id', id)
    .select('id, payment_status, claimed_by, claimed_at, fulfillment_status, shipped_at, delivered_at, tracking_number, notes')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Send the payment-confirmed email when an order transitions to 'paid'.
  // AWAITED on purpose: on Vercel a fire-and-forget promise can be frozen as
  // soon as the response is returned, silently dropping the email. Resend v3
  // also returns { data, error } instead of throwing, so check error explicitly.
  // Outcome is recorded on the order (payment_email_*) so it can be audited.
  let payment_email = null
  if (payment_status === 'paid' && prevPaymentStatus !== 'paid') {
    const { data: fullOrder } = await supabase
      .from('orders')
      .select('order_number, customer_name, customer_email, line_items, total')
      .eq('id', id)
      .single()
    if (fullOrder?.customer_email) {
      let sendError = null
      let resendId = null
      try {
        const result = await sendPaymentConfirmedEmail(fullOrder)
        if (result?.error) sendError = result.error.message || JSON.stringify(result.error)
        else resendId = result?.data?.id || null
      } catch (err) {
        sendError = err?.message || String(err)
      }
      if (sendError) console.error('[fulfillment/update] payment-confirmed email failed:', fullOrder.order_number, sendError)
      await supabase
        .from('orders')
        .update(sendError
          ? { payment_email_error: String(sendError).slice(0, 500) }
          : { payment_email_sent_at: new Date().toISOString(), payment_email_resend_id: resendId, payment_email_error: null })
        .eq('id', id)
      payment_email = sendError ? { sent: false, error: sendError } : { sent: true, id: resendId }
    } else {
      payment_email = { sent: false, error: 'No customer email on order' }
    }
  }

  return NextResponse.json(
    { ok: true, order: data, payment_email },
    { headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'CDN-Cache-Control': 'no-store',
      'Vercel-CDN-Cache-Control': 'no-store',
    }}
  )
}
