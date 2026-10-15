import { NextResponse } from 'next/server'
import { createServerClient } from '../../../../lib/supabase'
import { getAccessToken } from '../../../../lib/quickbooks'
import { mapQboCustomer } from '../../../../lib/qboCustomers'

// GET /api/cron/qbo-customers — daily (vercel.json) copy of every QuickBooks
// customer into public.qbo_customers, used by the first-order discount check.
//
// Read-only on QuickBooks. Protected by CRON_SECRET when that env var is set
// (Vercel sends it automatically on cron runs). Either way a run is skipped
// if one started in the last 6 hours, so the endpoint can't be hammered.
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'
export const maxDuration = 60

const BASE_URL = process.env.QBO_ENVIRONMENT === 'production'
  ? 'https://quickbooks.api.intuit.com'
  : 'https://sandbox-quickbooks.api.intuit.com'
const PAGE = 1000
const MIN_GAP_MS = 6 * 60 * 60 * 1000

export async function GET(request) {
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const realmId = process.env.QBO_REALM_ID
  if (!realmId) return NextResponse.json({ error: 'QBO_REALM_ID not configured' }, { status: 503 })

  const supabase = createServerClient()
  const { data: last } = await supabase.from('sync_runs').select('last_started_at').eq('name', 'qbo_customers').maybeSingle()
  if (last?.last_started_at && Date.now() - new Date(last.last_started_at).getTime() < MIN_GAP_MS) {
    return NextResponse.json({ skipped: true, reason: 'ran recently', last_started_at: last.last_started_at })
  }
  await supabase.from('sync_runs').upsert({ name: 'qbo_customers', last_started_at: new Date().toISOString(), last_error: null })

  try {
    const token = await getAccessToken()
    let start = 1, total = 0
    for (;;) {
      // Active = false included so closed-out customers still count as prior buyers.
      const q = `SELECT * FROM Customer WHERE Active IN (true, false) STARTPOSITION ${start} MAXRESULTS ${PAGE}`
      const r = await fetch(`${BASE_URL}/v3/company/${realmId}/query?query=${encodeURIComponent(q)}&minorversion=65`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      })
      const j = await r.json()
      if (!r.ok) throw new Error(`QBO ${r.status}: ${JSON.stringify(j).slice(0, 300)}`)
      const rows = (j.QueryResponse?.Customer || []).map(mapQboCustomer).filter(Boolean)
        .map(row => ({ ...row, synced_at: new Date().toISOString() }))
      if (rows.length) {
        const { error } = await supabase.from('qbo_customers').upsert(rows, { onConflict: 'qbo_id' })
        if (error) throw error
      }
      total += rows.length
      if (rows.length < PAGE) break
      start += PAGE
    }
    await supabase.from('sync_runs').upsert({ name: 'qbo_customers', last_finished_at: new Date().toISOString(), last_count: total, last_error: null })
    return NextResponse.json({ ok: true, customers: total })
  } catch (e) {
    await supabase.from('sync_runs').upsert({ name: 'qbo_customers', last_error: String(e?.message || e).slice(0, 500) })
    return NextResponse.json({ ok: false, error: 'sync failed' }, { status: 500 })
  }
}
