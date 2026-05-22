import { NextResponse } from 'next/server'
import { createLabCookieValue, LAB_COOKIE_NAME, labCookieOptions } from '../../../../lib/labAuth'

export const dynamic = 'force-dynamic'

// Every response is marked no-store so corporate / SSL-inspecting proxies
// can't cache an unlock outcome (a cached "invalid" or a cached success
// without the Set-Cookie would both break the flow for the next user).
function noStore(res) {
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  return res
}

// Structured log line -> picked up by Vercel runtime logs. We log first 2
// chars of the attempted code so a brute-force prefix sweep is visible
// without leaking full codes.
function logUnlockAttempt(request, outcome, code) {
  try {
    const ip = (request.headers.get('x-forwarded-for') || '')
      .split(',')[0]
      .trim() || 'unknown'
    const ua = (request.headers.get('user-agent') || '').slice(0, 200)
    console.log(JSON.stringify({
      event: 'lab-unlock',
      ts: new Date().toISOString(),
      outcome,
      code_prefix: code ? code.slice(0, 2) : '',
      ip,
      ua,
    }))
  } catch {
    // never let a logging failure break the unlock path
  }
}

export async function POST(request) {
  let body
  try { body = await request.json() } catch { return noStore(NextResponse.json({ error: 'Bad request' }, { status: 400 })) }

  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  if (!code) {
    logUnlockAttempt(request, 'empty_code', '')
    return noStore(NextResponse.json({ error: 'Code required' }, { status: 400 }))
  }

  const codes = (process.env.LAB_CODES || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  if (!codes.length) {
    logUnlockAttempt(request, 'not_configured', code)
    return noStore(NextResponse.json({ error: 'Lab not configured' }, { status: 503 }))
  }

  if (!codes.includes(code)) {
    logUnlockAttempt(request, 'invalid', code)
    return noStore(NextResponse.json({ error: 'Invalid code' }, { status: 401 }))
  }

  logUnlockAttempt(request, 'success', code)
  const res = noStore(NextResponse.json({ ok: true }))
  res.cookies.set(LAB_COOKIE_NAME, createLabCookieValue(), labCookieOptions(request.headers.get('host')))
  return res
}
