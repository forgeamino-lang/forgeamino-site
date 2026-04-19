import { NextResponse } from 'next/server'
import { createLabCookieValue, LAB_COOKIE_NAME } from '../../../../lib/labAuth'

export const dynamic = 'force-dynamic'

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
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }) }

  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  if (!code) {
    logUnlockAttempt(request, 'empty_code', '')
    return NextResponse.json({ error: 'Code required' }, { status: 400 })
  }

  const codes = (process.env.LAB_CODES || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  if (!codes.length) {
    logUnlockAttempt(request, 'not_configured', code)
    return NextResponse.json({ error: 'Lab not configured' }, { status: 503 })
  }

  if (!codes.includes(code)) {
    logUnlockAttempt(request, 'invalid', code)
    return NextResponse.json({ error: 'Invalid code' }, { status: 401 })
  }

  logUnlockAttempt(request, 'success', code)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(LAB_COOKIE_NAME, createLabCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    // No maxAge / expires  ->  session cookie; cleared on browser close.
  })
  return res
}
