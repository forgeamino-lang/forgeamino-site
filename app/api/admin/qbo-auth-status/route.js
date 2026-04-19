import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../../lib/adminAuth'

// Diagnostic: check the Vercel credentials that lib/quickbooks.js uses to
// auto-rotate QBO_REFRESH_TOKEN. Intuit rotates the refresh token on every
// access-token refresh; persistRefreshToken() writes the new one back to
// Vercel env via the Vercel API. If VERCEL_ACCESS_TOKEN is missing or stale,
// rotation fails silently (fire-and-forget .catch) and QBO auth eventually
// dies at Intuit's hard-expiry wall. This endpoint lets us verify the
// rotation machinery is healthy ahead of time.
//
// GET /api/admin/qbo-auth-status
// Auth: Authorization: Bearer <ADMIN_PASSWORD>
export const dynamic = 'force-dynamic'

const VERCEL_PROJECT_ID = 'forgeamino-site'
const VERCEL_TEAM_SLUG  = 'forgeamino-langs-projects'

export async function GET(request) {
  const unauthorized = requireAdmin(request)
  if (unauthorized) return unauthorized

  const notes = []
  const out = {
    ok: false,
    vercel_access_token_set: false,
    vercel_api_auth: null,
    vercel_scope_project_env: null,
    qbo_refresh_token_present: false,
    qbo_refresh_token_updated_at: null,
    qbo_refresh_token_age_hours: null,
    notes,
  }

  const token = process.env.VERCEL_ACCESS_TOKEN
  if (!token) {
    notes.push('VERCEL_ACCESS_TOKEN is not set in Vercel env. QBO refresh-token rotation will fail silently.')
    return NextResponse.json(out)
  }
  out.vercel_access_token_set = true

  // Check 1: /v2/user — minimal authenticated call to confirm the token works.
  try {
    const userRes = await fetch('https://api.vercel.com/v2/user', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (userRes.ok) {
      out.vercel_api_auth = 'ok'
    } else {
      out.vercel_api_auth = String(userRes.status)
      notes.push(`Vercel /v2/user returned ${userRes.status}. Token may be expired, revoked, or scoped wrong.`)
      return NextResponse.json(out)
    }
  } catch (e) {
    out.vercel_api_auth = 'error: ' + e.message
    notes.push('Network error calling Vercel /v2/user.')
    return NextResponse.json(out)
  }

  // Check 2: list project env — same call persistRefreshToken uses.
  try {
    const envRes = await fetch(
      `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env?teamSlug=${VERCEL_TEAM_SLUG}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
    )
    if (!envRes.ok) {
      out.vercel_scope_project_env = String(envRes.status)
      notes.push(`Vercel project env list returned ${envRes.status}. Token lacks scope for this project.`)
      return NextResponse.json(out)
    }
    out.vercel_scope_project_env = 'ok'
    const envData = await envRes.json()
    const qboEnv = (envData.envs || []).find(e => e.key === 'QBO_REFRESH_TOKEN')
    if (qboEnv) {
      out.qbo_refresh_token_present = true
      const updatedAt = qboEnv.updatedAt || qboEnv.createdAt
      if (updatedAt) {
        const iso = new Date(updatedAt).toISOString()
        out.qbo_refresh_token_updated_at = iso
        out.qbo_refresh_token_age_hours =
          Math.round(((Date.now() - updatedAt) / 36000) ) / 100
      }
    } else {
      notes.push('QBO_REFRESH_TOKEN not found in project env list.')
      return NextResponse.json(out)
    }
  } catch (e) {
    out.vercel_scope_project_env = 'error: ' + e.message
    notes.push('Network error listing project env.')
    return NextResponse.json(out)
  }

  out.ok = true
  if (out.qbo_refresh_token_age_hours !== null && out.qbo_refresh_token_age_hours > 24 * 30) {
    notes.push(`QBO_REFRESH_TOKEN has not been updated in ${Math.round(out.qbo_refresh_token_age_hours / 24)} days. Rotation may not be firing — confirm by hitting a QBO endpoint and re-running this check.`)
  }
  return NextResponse.json(out)
}
