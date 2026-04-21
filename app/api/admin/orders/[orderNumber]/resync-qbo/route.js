import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../../../../lib/adminAuth'
import { createServerClient } from '../../../../../../lib/supabase'
import { syncToQuickBooks } from '../../../../../../lib/quickbooks'

// Re-drive QBO sync (invoice + admin PDF email) for an order that's already
// stored in Supabase but whose original sync failed.
//
// POST /api/admin/orders/FA-8842/resync-qbo
// Auth: Authorization: Bearer <ADMIN_PASSWORD>
//
// Does NOT resend the customer confirmation email (that fired on the
// original /api/orders call).
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
    const invoice = await syncToQuickBooks(order)
    return NextResponse.json({
      ok: true,
      order_number: orderNumber,
      invoice_id: invoice?.Id || invoice?.invoice?.Id || null,
      invoice_doc_number: invoice?.DocNumber || invoice?.invoice?.DocNumber || null,
      invoice_total: invoice?.TotalAmt ?? invoice?.invoice?.TotalAmt ?? null,
    })
  } catch (e) {
    // Bubble the real error up so we can see QBO's actual complaint instead
    // of it disappearing into Vercel runtime logs.
    return NextResponse.json({
      ok: false,
      order_number: orderNumber,
      error: e?.message || String(e),
      stack: e?.stack || null,
    }, { status: 500 })
  }
}
