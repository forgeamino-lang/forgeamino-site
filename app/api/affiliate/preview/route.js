import { NextResponse } from 'next/server'
import { createServerClient } from '../../../../lib/supabase'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0
export const runtime = 'nodejs'

// GET /api/affiliate/preview?code=FRIENDS
// Returns: { valid: boolean, discount_pct: number (0-1), name?: string }
// Public endpoint — no auth needed. Only reveals discount_pct and name
// for codes that exist + are active; never leaks the affiliates table.
export async function GET(request) {
  const url = new URL(request.url)
  const code = (url.searchParams.get('code') || '').trim()
  if (!code) {
    return NextResponse.json({ valid: false }, { headers: { 'Cache-Control': 'no-store' } })
  }
  try {
    const supabase = createServerClient()
    const { data: aff } = await supabase
      .from('affiliates')
      .select('code, name, discount_pct')
      .ilike('code', code)
      .eq('active', true)
      .maybeSingle()
    if (!aff) {
      return NextResponse.json({ valid: false }, { headers: { 'Cache-Control': 'no-store' } })
    }
    return NextResponse.json({
      valid: true,
      code: aff.code,
      name: aff.name,
      discount_pct: Number(aff.discount_pct || 0),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ valid: false, error: 'lookup_failed' }, { status: 500 })
  }
}
