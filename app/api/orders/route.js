import { NextResponse } from 'next/server'
import { createServerClient, generateOrderNumber } from '../../../lib/supabase'
import { sendOrderConfirmationEmail, sendOrderReceivedAlert } from '../../../lib/email'
import { syncToQuickBooks } from '../../../lib/quickbooks'
import { requireAdmin } from '../../../lib/adminAuth'
import * as Sentry from '@sentry/nextjs'
import { validateLineItems, computeOrderTotals } from '../../../lib/orderValidation'
import { verifyLabCookie } from '../../../lib/labAuth'

export async function POST(request) {
  try {
    const body = await request.json()
    const {
      customer_name,
      customer_email,
      customer_phone,
      shipping_address,
      payment_method,
      shipping_method,
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

    // ── Server-side line-item validation ────────────────────────────────────
    // All validation logic lives in lib/orderValidation.js (pure + unit-tested).
    // In short: slug must match a known product; hidden products need lab
    // access; prices + qbo_name are substituted from the catalog.
    const hasLabAccess = verifyLabCookie()
    const v = validateLineItems(line_items, { hasLabAccess })
    if (!v.ok) {
      return NextResponse.json({ error: v.error }, { status: v.status })
    }
    const validated_line_items = v.validated

    // Server-trusted totals — subtotal from catalog prices, tax_rate from client.
    const {
      subtotal: server_subtotal,
      tax_rate: trusted_tax_rate,
      tax_amount: server_tax_amount,
      shipping_method: trusted_shipping_method,
      shipping_amount: server_shipping_amount,
      total: server_total,
    } = computeOrderTotals(validated_line_items, tax_rate, shipping_method)

    // Warn loudly if client-computed totals diverged by more than 1¢.
    const client_total = Number(total)
    if (Number.isFinite(client_total) && Math.abs(client_total - server_total) > 0.01) {
      console.warn('Order total mismatch (using server values):', {
        client_total, server_total,
        client_subtotal: subtotal, server_subtotal,
        client_tax: tax_amount, server_tax: server_tax_amount,
      })
    }

    const supabase = createServerClient()
    const order_number = generateOrderNumber()

    // Embed tax data in shipping_address JSONB to avoid schema changes
    const shipping_address_with_tax = {
      ...shipping_address,
      subtotal: server_subtotal,
      tax_amount: server_tax_amount,
      tax_rate: trusted_tax_rate,
      shipping_method: trusted_shipping_method,
      shipping_amount: server_shipping_amount,
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
        line_items: validated_line_items,
        total: server_total,
        payment_status: 'pending',
        fulfillment_status: 'pending',
      })
      .select('id')
      .single()

    if (error) {
      console.error('Supabase error:', error)
      Sentry.captureException(new Error('Supabase order insert failed'), {
        extra: {
          supabase_error: error,
          customer_email,
          order_number,
        },
        tags: { area: 'orders', failure: 'supabase-insert' },
      })
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
    }

    const order = {
      id: data.id,
      order_number,
      customer_name,
      customer_email,
      shipping_address: shipping_address_with_tax,
      payment_method,
      line_items: validated_line_items,
      subtotal: server_subtotal,
      tax_amount: server_tax_amount,
      tax_rate: trusted_tax_rate,
      shipping_method: trusted_shipping_method,
      shipping_amount: server_shipping_amount,
      total: server_total,
    }

// Fan out three independent side effects:
    //  1. Customer order confirmation (Resend)
    //  2. Admin "order received" alert — fires regardless of QBO health, so we
    //     never go blind on orders again when token rotation breaks
    //  3. QuickBooks invoice sync (which itself sends the PDF email on success)
    // None of these can fail the order — they're all .catch'd to Sentry/console.
    await Promise.all([
      sendOrderConfirmationEmail(order).catch(e => console.error('Customer email failed:', e)),
      sendOrderReceivedAlert(order).catch(e => {
        console.error('Admin order-received alert failed:', e)
        Sentry.captureException(e, {
          extra: { order_number, customer_email },
          tags: { area: 'orders', failure: 'admin-alert' },
        })
      }),
      syncToQuickBooks(order).catch(e => {
        console.error('QuickBooks sync failed:', { order_number, customer_name, customer_email, error: e?.message, stack: e?.stack, raw: String(e) })
        Sentry.captureException(e, {
          extra: { order_number, customer_email },
          tags: { area: 'orders', failure: 'quickbooks-sync' },
        })
      })
    ])

    return NextResponse.json({ orderId: data.id, orderNumber: order_number })
  } catch (err) {
    console.error('Order creation error:', err)
    Sentry.captureException(err, {
      tags: { area: 'orders', failure: 'unhandled' },
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request) {
  // Admin only: list all orders
  const authFail = requireAdmin(request)
  if (authFail) return authFail

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ orders: data })
}
