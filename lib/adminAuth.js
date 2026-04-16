import { NextResponse } from 'next/server'

// Shared admin auth helper.
// Preferred: Authorization: Bearer <ADMIN_PASSWORD>
// Legacy fallback (deprecated): ?key=<ADMIN_PASSWORD> query string.
//   The legacy path will log a warning so we can phase it out once all callers are updated.
//
// Returns null on success (caller continues).
// Returns a NextResponse with 401 on failure (caller should `return` it).
export function requireAdmin(request) {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) {
    return NextResponse.json(
      { error: 'ADMIN_PASSWORD env var not configured on server' },
      { status: 500 }
    )
  }

  // 1) Preferred: Authorization header
  const authHeader = request.headers.get('authorization') || ''
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i)
  if (bearerMatch && bearerMatch[1] === expected) {
    return null
  }

  // 2) Legacy fallback: ?key= query string
  const { searchParams } = new URL(request.url)
  const keyParam = searchParams.get('key')
  if (keyParam && keyParam === expected) {
    console.warn(
      'Deprecated ?key= auth used on admin endpoint; switch to Authorization: Bearer header'
    )
    return null
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

