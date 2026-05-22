import { NextResponse } from 'next/server'
import { LAB_COOKIE_NAME, labCookieOptions } from '../../../../lib/labAuth'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const res = NextResponse.json({ ok: true })
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  // Clear the cookie. Must reuse the same domain scoping as labCookieOptions,
  // otherwise a cookie set with domain=.forgeamino.com would not be cleared.
  res.cookies.set(LAB_COOKIE_NAME, '', { ...labCookieOptions(request.headers.get('host')), maxAge: 0 })
  return res
}
