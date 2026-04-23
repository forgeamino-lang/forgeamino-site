import { NextResponse } from 'next/server'

// Shared admin auth helper.
// Accepts either of:
//   - Authorization: Bearer <ADMIN_PASSWORD>   (preferred for curl/programmatic)
//   - ?key=<ADMIN_PASSWORD>                    (used by the /admin web page)
//
// Returns null on success (caller continues).
// Returns a NextResponse with 401 on failure (caller should return it immediately).
// Returns a NextResponse with 500 if ADMIN_PASSWORD env var is unset.

export function requireAdmin(request) {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) {
    return NextResponse.json(
      { error: 'ADMIN_PASSWORD env var not configured on server' },
      { status: 500 }
    )
  }

  // Bearer header (preferred)
  const authHeader = request.headers.get('authorization') || ''
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i)
  if (bearerMatch && bearerMatch[1] === expected) {
    return null
  }

  // ?key= query param (fallback — used by /admin browser login)
  const url = new URL(request.url)
  const key = url.searchParams.get('key')
  if (key && key === expected) {
    return null
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
