import { NextResponse } from 'next/server'
import { createLabCookieValue, LAB_COOKIE_NAME } from '../../../../lib/labAuth'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  let body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }) }

  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 })

  const codes = (process.env.LAB_CODES || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  if (!codes.length) {
    return NextResponse.json({ error: 'Lab not configured' }, { status: 503 })
  }

  if (!codes.includes(code)) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 401 })
  }

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
