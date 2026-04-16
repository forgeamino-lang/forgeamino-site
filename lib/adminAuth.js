import { NextResponse } from 'next/server'

// Shared admin auth helper.
// Requires: Authorization: Bearer <ADMIN_PASSWORD>
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

  const authHeader = request.headers.get('authorization') || ''
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i)
  if (bearerMatch && bearerMatch[1] === expected) {
    return null
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
