import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../../lib/adminAuth'
import { createServerClient } from '../../../../lib/supabase'

// GET    /api/admin/affiliate-attributions?key=...        — list every mapping
// POST   /api/admin/affiliate-attributions?key=...        — { email, code, notes? } create/update
// DELETE /api/admin/affiliate-attributions?email=...&key=...   — clear one
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0
export const runtime = 'nodejs'

export async function GET(request) {
  const unauthorized = requireAdmin(request)
  if (unauthorized) return unauthorized
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('customer_affiliate_attribution')
    .select('*')
    .order('first_attributed_at', { ascending: false })
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, count: data.length, attributions: data }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(request) {
  const unauthorized = requireAdmin(request)
  if (unauthorized) return unauthorized
  const body = await request.json().catch(() => ({}))
  const email = (body?.email || '').trim().toLowerCase()
  const code  = (body?.code  || '').trim()
  const notes = (body?.notes || null)
  if (!email || !code) {
    return NextResponse.json({ ok: false, error: 'email and code required' }, { status: 400 })
  }
  const supabase = createServerClient()
  // Resolve code to affiliate_id (case-insensitive match, like /api/orders does)
  const { data: aff } = await supabase
    .from('affiliates').select('id, code').ilike('code', code).maybeSingle()
  if (!aff) {
    return NextResponse.json({ ok: false, error: `Affiliate code "${code}" not found in affiliates table` }, { status: 404 })
  }
  const row = {
    customer_email: email,
    affiliate_code: aff.code,
    affiliate_id: aff.id,
    notes,
  }
  const { data, error } = await supabase
    .from('customer_affiliate_attribution')
    .upsert(row, { onConflict: 'customer_email' })
    .select()
    .maybeSingle()
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, attribution: data })
}

export async function DELETE(request) {
  const unauthorized = requireAdmin(request)
  if (unauthorized) return unauthorized
  const url = new URL(request.url)
  const email = (url.searchParams.get('email') || '').trim().toLowerCase()
  if (!email) return NextResponse.json({ ok: false, error: 'email param required' }, { status: 400 })
  const supabase = createServerClient()
  const { error } = await supabase
    .from('customer_affiliate_attribution')
    .delete()
    .eq('customer_email', email)
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, deleted: email })
}
