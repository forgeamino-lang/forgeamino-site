import { NextResponse } from 'next/server'
import { verifyLabCookie } from '../../../../lib/labAuth'

export const dynamic = 'force-dynamic'

// Lightweight check the unlock form calls right after a successful code
// submission to confirm the fa_lab cookie actually persisted. On locked-down
// corporate networks the Set-Cookie can be stripped or the cookie blocked —
// in that case the code was accepted but this still reports unlocked:false,
// letting the form show real guidance instead of a silent dead-end.
export async function GET() {
  const res = NextResponse.json({ unlocked: verifyLabCookie() })
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  return res
}
