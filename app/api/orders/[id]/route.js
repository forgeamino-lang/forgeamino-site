import { NextResponse } from 'next/server'
import { createServerClient } from '../../../../lib/supabase'
import { sendPaymentConfirmedEmail, sendShippedEmail } from '../../../../lib/email'

// PATCH — update order status (admin use)
export async function PATCH(request, { params }) {
  const adminKey = request.headers.get('x-admin-key')
  if (adminKey !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { payment_status, fulfillment_status, tracking_number, notes } = body
  const supabase = createServerClient()

  const updates = {}
  if (payment_status) updates.payment_status = payment_status
  if (fulfillment_status) updates.fulfillment_status = fulfillment_status
  if (tracking_number !== undefined) updates.tracking_number = tracking_number
  if (notes !== undefined) updates.notes = notes

  const { data, error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Trigger emails based on status changes
  if (payment_status === 'paid') {
    sendPaymentConfirmedEmail(data).catch(e => console.error('Email failed:', e))
  }
  if (fulfillment_status === 'shipped') {
    sendShippedEmail(data).catch(e => console.error('Email failed:', e))
  }

  return NextResponse.json({ order: data })
}

// GET — fetch a single order (public, by UUID — safe for confirmation page)
export async function GET(request, { params }) {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, customer_email, shipping_address, payment_method, line_items, total, payment_status, fulfillment_status, tracking_number, created_at')
    .eq('id', params.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  return NextResponse.json({ order: data })
}
