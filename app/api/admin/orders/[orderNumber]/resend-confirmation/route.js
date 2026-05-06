import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../../../../lib/adminAuth'
import { createServerClient } from '../../../../../../lib/supabase'
import { sendOrderConfirmationEmail } from '../../../../../../lib/email'

// Re-fire the customer order confirmation email for an existing order.
// Useful when a customer reports they didn't receive the original email
// (junk folder, deliverability glitch, etc.) so we can fire a fresh one
// without making them place the order again.
//
// POST /api/admin/orders/FA-7019/resend-confirmation
// Auth: ?key=ADMIN_PASSWORD or Authorization: Bearer ADMIN_PASSWORD
//
// Does NOT re-fire QBO sync, push notifications, or admin alerts —
// strictly the customer-facing confirmation.

export const dynamic = 'force-dynamic'

export async function POST(request, { params }) {
  const unauthorized = requireAdmin(request)
  if (unauthorized) return unauthorized

  const orderNumber = params?.orderNumber
  if (!orderNumber) {
    return NextResponse.json({ ok: false, error: 'Missing orderNumber' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data: order, error: selErr } = await supabase
    .from('orders')
    .select('*')
    .eq('order_number', orderNumber)
    .maybeSingle()
  if (selErr) {
    return NextResponse.json({ ok: false, error: `Supabase: ${selErr.message}` }, { status: 500 })
  }
  if (!order) {
    return NextResponse.json({ ok: false, error: `Order ${orderNumber} not found` }, { status: 404 })
  }

  try {
    const result = await sendOrderConfirmationEmail(order)
    // Resend returns { data: { id, ... }, error: null } on success
    return NextResponse.json({
      ok: true,
      order_number: orderNumber,
      to: order.customer_email,
      payment_method: order.payment_method,
      resend_id: result?.data?.id || result?.id || null,
      resend_error: result?.error || null,
      raw: result,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({
      ok: false,
      order_number: orderNumber,
      to: order.customer_email,
      error: e?.message || String(e),
      stack: e?.stack || null,
    }, { status: 500 })
  }
}
