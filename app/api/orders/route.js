import { NextResponse } from 'next/server'
import { createServerClient, generateOrderNumber } from '../../../lib/supabase'
import { sendOrderConfirmationEmail, sendAdminOrderAlert } from '../../../lib/email'

export async function POST(request) {
  try {
    const body = await request.json()
    const {
      customer_name,
      customer_email,
      customer_phone,
      shipping_address,
      payment_method,
      line_items,
      total,
    } = body

    // Basic validation
    if (!customer_name || !customer_email || !shipping_address || !line_items?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createServerClient()
    const order_number = generateOrderNumber()

    // Insert order into database
    const { data, error } = await supabase
      .from('orders')
      .insert({
        order_number,
        customer_name,
        customer_email,
        customer_phone,
        shipping_address,
        payment_method,
        line_items,
        total,
        payment_status: 'pending',
        fulfillment_status: 'pending',
      })
      .select('id')
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
    }

    const order = { id: data.id, order_number, customer_name, customer_email, shipping_address, payment_method, line_items, total }

    // Send emails (non-blocking — don't fail the order if email fails)
    Promise.all([
      sendOrderConfirmationEmail(order).catch(e => console.error('Customer email failed:', e)),
      sendAdminOrderAlert(order).catch(e => console.error('Admin email failed:', e)),
    ])

    return NextResponse.json({ orderId: data.id, orderNumber: order_number })
  } catch (err) {
    console.error('Order creation error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request) {
  // Admin only: list all orders
  const { searchParams } = new URL(request.url)
  const adminKey = searchParams.get('key')

  if (adminKey !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ orders: data })
}
