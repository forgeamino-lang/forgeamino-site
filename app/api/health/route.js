import { NextResponse } from 'next/server'
import { createServerClient } from '../../../lib/supabase'
import { PRODUCTS } from '../../../lib/products'

export const dynamic = 'force-dynamic'

// ── Check 1: Supabase connectivity + order health ─────────────────────────────
async function checkSupabase(sb) {
  try {
    const { data, error } = await sb
      .from('orders')
      .select('id, order_number, payment_status, fulfillment_status, created_at')
      .order('created_at', { ascending: false })
      .limit(30)
    if (error) throw error

    const now = Date.now()
    const stuckPayments = []
    const unshippedPaid = []

    for (const o of data) {
      const ageHours = (now - new Date(o.created_at).getTime()) / 3_600_000
      // Paid order sitting unfulfilled for more than 3 days
      if (o.payment_status === 'paid' && o.fulfillment_status === 'pending' && ageHours > 72) {
        unshippedPaid.push({ id: o.order_number || o.id, ageHours: Math.round(ageHours) })
      }
    }

    const warns = []
    if (unshippedPaid.length) warns.push(`${unshippedPaid.length} paid order(s) unfulfilled for >72h: ${unshippedPaid.map(o => o.id).join(', ')}`)

    return {
      ok: true,
      recentOrders: data.length,
      unshippedPaid,
      warns,
    }
  } catch (err) {
    return { ok: false, error: err.message, warns: [] }
  }
}

// ── Check 2: QBO config presence ──────────────────────────────────────────────
async function checkQBO(sb) {
  try {
    const requiredEnvVars = ['QBO_CLIENT_ID', 'QBO_CLIENT_SECRET', 'QBO_REALM_ID', 'QBO_REDIRECT_URI']
    const missingEnv = requiredEnvVars.filter(k => !process.env[k])

    // Check the refresh token is present in the secrets table
    const { data, error } = await sb
      .from('secrets')
      .select('value, updated_at')
      .eq('key', 'qbo_refresh_token')
      .maybeSingle()

    const warns = []
    const issues = []

    if (missingEnv.length) issues.push(`Missing env vars: ${missingEnv.join(', ')}`)
    if (error) issues.push(`Secrets table error: ${error.message}`)
    if (!data) issues.push('QBO refresh token not found in secrets table')

    if (data?.updated_at) {
      const ageDays = (Date.now() - new Date(data.updated_at).getTime()) / 86_400_000
      if (ageDays > 90) {
        warns.push(`QBO refresh token is ${Math.round(ageDays)} days old — may be near expiry`)
      }
    }

    return {
      ok: issues.length === 0,
      refreshTokenPresent: !!data,
      refreshTokenUpdatedAt: data?.updated_at ?? null,
      missingEnv,
      issues,
      warns,
    }
  } catch (err) {
    return { ok: false, error: err.message, warns: [], issues: [err.message] }
  }
}

// ── Check 3: Product catalog integrity ────────────────────────────────────────
function checkCatalog() {
  try {
    const issues = []
    const warns = []

    for (const p of PRODUCTS) {
      // Products with price > 0 and not hidden need a qbo_name for invoices
      if (p.price > 0 && !p.hidden && !p.qbo_name) {
        issues.push({ id: p.id, name: p.name, issue: 'missing qbo_name (will fall back to "Services" in QBO)' })
      }
      // Encoding corruption check: â chars from bad btoa() re-encoding
      const serialized = JSON.stringify(p)
      if (/â[-¿]/.test(serialized)) {
        issues.push({ id: p.id, name: p.name, issue: 'encoding corruption detected (â chars in product data)' })
      }
      // Slug sanity
      if (!p.slug) {
        warns.push({ id: p.id, name: p.name, issue: 'missing slug' })
      }
    }

    return {
      ok: issues.length === 0,
      productCount: PRODUCTS.length,
      issues,
      warns,
    }
  } catch (err) {
    return { ok: false, error: err.message, issues: [err.message], warns: [] }
  }
}

// ── Check 4: Active promo codes ───────────────────────────────────────────────
async function checkPromos(sb) {
  try {
    const { data, error } = await sb
      .from('affiliates')
      .select('code, name, expires_at, active, discount_pct')
      .eq('active', true)
    if (error) throw error

    const now = new Date()
    const expiredButActive = data.filter(a => a.expires_at && new Date(a.expires_at) < now)
    const warns = expiredButActive.length
      ? [`${expiredButActive.length} promo code(s) are expired but still marked active: ${expiredButActive.map(a => a.code).join(', ')}`]
      : []

    return {
      ok: true,
      activePromos: data.length,
      expiredButActive: expiredButActive.map(a => ({ code: a.code, expiredAt: a.expires_at })),
      warns,
    }
  } catch (err) {
    return { ok: false, error: err.message, warns: [] }
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function GET() {
  const sb = createServerClient()

  const [supabase, qbo, promos] = await Promise.all([
    checkSupabase(sb),
    checkQBO(sb),
    checkPromos(sb),
  ])
  const catalog = checkCatalog()

  const checks = { supabase, qbo, catalog, promos }

  const allOk = Object.values(checks).every(c => c.ok)
  const allWarns = Object.values(checks).flatMap(c => c.warns ?? [])

  let status = 'ok'
  if (!allOk) status = 'error'
  else if (allWarns.length) status = 'degraded'

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      summary: allWarns.length ? allWarns : (allOk ? ['All systems operational'] : []),
      checks,
    },
    { status: allOk ? 200 : 500 }
  )
}
