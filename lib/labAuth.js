import crypto from 'crypto'
import { cookies } from 'next/headers'

// HMAC-signed session cookie for the /lab section.
// Cookie value: <random-nonce>.<hmac-sha256(nonce)>
// Stateless — verifies without storing anything server-side.
// Session cookie (no maxAge/expires) so it dies on browser close,
// which matches the product requirement of session-only unlock.

export const LAB_COOKIE_NAME = 'fa_lab'

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
