import crypto from 'crypto'

const JWT_SECRET = process.env.AFFILIATE_JWT_SECRET || 'change-me-in-production'
const COOKIE_NAME = 'affiliate_session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

// --- Password hashing (Node crypto scrypt) ---

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return salt + ':' + hash
}

export function verifyPassword(password, stored) {
  try {
    const idx = stored.indexOf(':')
    const salt = stored.slice(0, idx)
    const hash = stored.slice(idx + 1)
    const attempt = crypto.scryptSync(password, salt, 64).toString('hex')
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(attempt, 'hex'))
  } catch {
    return false
  }
}

// --- JWT (HS256 using Node built-ins, no external lib) ---

function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export function signToken(payload) {
  const header = b64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const now = Math.floor(Date.now() / 1000)
  const body = b64url(Buffer.from(JSON.stringify({ ...payload, iat: now, exp: now + COOKIE_MAX_AGE })))
  const sig = b64url(crypto.createHmac('sha256', JWT_SECRET).update(header + '.' + body).digest())
  return header + '.' + body + '.' + sig
}

export function verifyToken(token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [header, body, sig] = parts
    const expected = b64url(crypto.createHmac('sha256', JWT_SECRET).update(header + '.' + body).digest())
    if (expected !== sig) return null
    const payload = JSON.parse(Buffer.from(body, 'base64').toString('utf8'))
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export { COOKIE_NAME, COOKIE_MAX_AGE }
