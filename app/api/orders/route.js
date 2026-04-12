import { NextResponse } from 'next/server'
import { createServerClient, generateOrderNumber } from '../../../lib/supabase'
import { sendOrderConfirmationEmail, sendAdminOrderAlert } from '../../../lib/email'
import { getAccessToken, findOrCreateCustomer, createInvoice } from '../../../lib/quickbooks'

async function syncToQuickBooks(order) {
  if (!process.env.QBO_REFRESH_TOKEN || !process.env.QBO_REALM_ID) return
  const accessToken = await getAccessToken()
  const realmId = process.env.QBO_REALM_ID
  const customer = await findOrCreateCustomer(accessToken, realmId, {
    name: order.customer_name,
    email: order.customer_email,
    phone: order.customer_phone,
    address: order.shipping_address,
  })
  await createInvoice(accessToken, realmId, { customer, order })
}

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
      subtotal,
      tax_amount,
      tax_rate,
      total,
    } = body

    // Basic validation
    if (!customer_name || !customer_email || !shipping_address || !line_items?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createServerClient()
    const order_number = generateOrderNumber()

    // Embed tax data in shipping_address JSONB to avoid schema changes
    const shipping_address_with_tax = {
      ...shipping_address,
      subtotal: subtotal ?? total,
      tax_amount: tax_amount ?? 0,
      tax_rate: tax_rate ?? 0,
    }

    // Insert order into database
    const { data, error } = await supabase
      .from('orders')
      .insert({
        order_number,
        customer_name,
        customer_email,
        customer_phone,
        shipping_address: shipping_address_with_tax,
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

    const order = {
      id: data.id,
      order_number,
      customer_name,
      customer_email,
      shipping_address: shipping_address_with_tax,
      payment_method,
      line_items,
      subtotal: subtotal ?? total,
      tax_amount: tax_amount ?? 0,
      tax_rate: tax_rate ?? 0,
      total,
    }

    // Send emails + sync to QuickBooks (non-blocking — don't fail the order if these fail)
    await Promise.all([      sendOrderConfirmationEmail(order).catch(e => console.error('Customer email failed:', e)),
      sendAdminOrderAlert(order).catch(e => console.error('Admin email failed:', e)),
      syncToQuickBooks(order).catch(e => console.error('QuickBooks sync failed:', e)),
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
