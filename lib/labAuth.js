import crypto from 'crypto'
import { cookies } from 'next/headers'

// HMAC-signed session cookie for the /lab section.
// Cookie value: <random-nonce>.<hmac-sha256(nonce)>
// Stateless — verifies without storing anything server-side.
//
// NOTE: the LAB ACCESS CODES themselves (LAB_CODES env var) are a plain
// allowlist and are NOT affected by anything here — they remain reusable
// indefinitely by everyone they're shared with. This file only governs the
// per-browser "unlocked" cookie that a valid code grants.

export const LAB_COOKIE_NAME = 'fa_lab'

// How long an unlocked session lasts on a device. Previously a pure session
// cookie (died on browser close) — which several locked-down / corporate
// browsers drop immediately. A bounded TTL survives "clear on close" timing
// and aggressive cookie handling while still expiring on its own.
export const LAB_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 365 days (1 year)

function secret() {
  return process.env.LAB_COOKIE_SECRET || ''
}

function hmac(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('hex')
}

export function createLabCookieValue() {
  const nonce = crypto.randomBytes(16).toString('hex')
  return `${nonce}.${hmac(nonce)}`
}

// Build the Set-Cookie options for the lab cookie.
// `host` is the request Host header. When the request is on the real
// forgeamino.com domain we scope the cookie to `.forgeamino.com` so it works
// across both the apex and the www subdomain (a user unlocked on one host
// would otherwise lose the cookie if anything bounced them to the other).
// On preview deploys / localhost we leave it host-only so it still works.
export function labCookieOptions(host) {
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: LAB_COOKIE_MAX_AGE,
  }
  const h = (host || '').toLowerCase().split(':')[0]
  if (h === 'forgeamino.com' || h.endsWith('.forgeamino.com')) {
    opts.domain = '.forgeamino.com'
  }
  return opts
}

export function verifyLabCookie() {
  if (!secret()) return false
  const c = cookies().get(LAB_COOKIE_NAME)
  if (!c?.value) return false
  const parts = c.value.split('.')
  if (parts.length !== 2) return false
  const [nonce, sig] = parts
  if (!nonce || !sig) return false
  const expected = hmac(nonce)
  try {
    const a = Buffer.from(sig, 'hex')
    const b = Buffer.from(expected, 'hex')
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}
