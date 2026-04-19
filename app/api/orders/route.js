import { NextResponse } from 'next/server'
import { createServerClient, generateOrderNumber } from '../../../lib/supabase'
import { sendOrderConfirmationEmail } from '../../../lib/email'
import { syncToQuickBooks } from '../../../lib/quickbooks'
import { requireAdmin } from '../../../lib/adminAuth'
import { getProductBySlug } from '../../../lib/products'
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
    // Never trust client-supplied prices or slugs.  Each line_item must:
    //   - reference a known product (slug lookup);
    //   - if marked hidden, be accompanied by a valid Lab session cookie;
    //   - carry the server-side price;
    //   - carry qbo_name so the QBO invoice maps to the right inventory item.
    const hasLabAccess = verifyLabCookie()
    const validated_line_items = []
    for (const raw of line_items) {
      const slug = typeof raw?.slug === 'string' ? raw.slug.trim() : ''
      if (!slug) {
        return NextResponse.json({ error: 'Missing product slug' }, { status: 400 })
      }
      const product = getProductBySlug(slug)
      if (!product) {
        return NextResponse.json({ error: `Unknown product: ${slug}` }, { status: 400 })
      }
      if (product.hidden && !hasLabAccess) {
        return NextResponse.json({ error: 'Access denied' }, { status: 401 })
      }
      const qty = Math.max(1, Math.min(99, parseInt(raw.quantity, 10) || 1))
      validated_line_items.push({
        id: product.id,
        slug: product.slug,
        name: product.name,
        qbo_name: product.qbo_name || product.name,
        price: product.price,
        quantity: qty,
        image: product.image || null,
      })
    }

    // Server-side totals.  We trust the client's tax_rate (location-dependent)
    // but recompute subtotal + tax_amount + total from validated prices.
    const server_subtotal = Number(
      validated_line_items.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2)
    )
    const trusted_tax_rate = Number.isFinite(Number(tax_rate)) ? Number(tax_rate) : 0
    const server_tax_amount = Number((server_subtotal * trusted_tax_rate).toFixed(2))
    const server_total = Number((server_subtotal + server_tax_amount).toFixed(2))

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
      total: server_total,
    }

    // Send emails + sync to QuickBooks (non-blocking — don't fail the order if these fail)
    await Promise.all([
      sendOrderConfirmationEmail(order).catch(e => console.error('Customer email failed:', e)),
      syncToQuickBooks(order).catch(e => console.error('QuickBooks sync failed:', { order_number, customer_name, customer_email, error: e?.message, stack: e?.stack, raw: String(e) }))
    ])

    return NextResponse.json({ orderId: data.id, orderNumber: order_number })
  } catch (err) {
    console.error('Order creation error:', err)
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
