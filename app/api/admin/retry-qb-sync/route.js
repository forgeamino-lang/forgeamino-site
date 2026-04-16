import { NextResponse } from 'next/server'
import { createServerClient } from '../../../../lib/supabase'
import { syncToQuickBooks } from '../../../../lib/quickbooks'

// Admin-protected retry endpoint for failed QuickBooks syncs.
// Usage: GET /api/admin/retry-qb-sync?key=ADMIN_PASSWORD&order_id=UUID
//        GET /api/admin/retry-qb-sync?key=ADMIN_PASSWORD&order_number=FA-...
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')
  const orderId = searchParams.get('order_id')
  const orderNumber = searchParams.get('order_number')

  if (!process.env.ADMIN_PASSWORD || key !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!orderId && !orderNumber) {
    return NextResponse.json(
      { error: 'Missing order_id or order_number query param' },
      { status: 400 }
    )
  }

  if (!process.env.QBO_REFRESH_TOKEN || !process.env.QBO_REALM_ID) {
    return NextResponse.json(
      { error: 'QBO env vars missing (QBO_REFRESH_TOKEN or QBO_REALM_ID)' },
      { status: 500 }
    )
  }

  try {
    const supabase = createServerClient()
    let query = supabase.from('orders').select('*')
    if (orderId) query = query.eq('id', orderId)
    else query = query.eq('order_number', orderNumber)
    const { data: order, error: fetchError } = await query.single()

    if (fetchError || !order) {
      return NextResponse.json(
        { error: 'Order not found', details: fetchError?.message || null },
        { status: 404 }
      )
    }

    const invoice = await syncToQuickBooks(order)

    return NextResponse.json({
      ok: true,
      order_id: order.id,
      order_number: order.order_number,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      invoice_id: invoice?.Id || null,
      invoice_doc_number: invoice?.DocNumber || null,
      invoice,
    })
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || String(e),
        stack: e?.stack || null,
      },
      { status: 500 }
    )
  }
}

