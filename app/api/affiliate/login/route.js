import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { scryptSync, timingSafeEqual, createHmac, randomBytes } from 'crypto'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const JWT_SECRET = process.env.AFFILIATE_JWT_SECRET || 'change-me-in-production'
const COOKIE_NAME = 'affiliate_session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7

function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function verifyPassword(password, stored) {
  try {
    const idx = stored.indexOf(':')
    const salt = stored.slice(0, idx)
    const hash = stored.slice(idx + 1)
    const attempt = scryptSync(password, salt, 64).toString('hex')
    return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(attempt, 'hex'))
  } catch { return false }
}

function signToken(payload) {
  const header = b64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const now = Math.floor(Date.now() / 1000)
  const body = b64url(Buffer.from(JSON.stringify({ ...payload, iat: now, exp: now + COOKIE_MAX_AGE })))
  const sig = b64url(createHmac('sha256', JWT_SECRET).update(header + '.' + body).digest())
  return header + '.' + body + '.' + sig
}

export async function POST(req) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
    const { code, password } = await req.json()
    if (!code || !password) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    const { data: affiliate, error: dbErr } = await supabase
      .from('affiliates')
      .select('id, code, name, commission_rate, password_hash, active')
      .eq('code', code.trim().toUpperCase())
      .maybeSingle()
    if (dbErr) {
      return NextResponse.json({ error: 'Server error', detail: dbErr.message }, { status: 500 })
    }
    if (!affiliate || !affiliate.active || !affiliate.password_hash) {
      return NextResponse.json({ error: 'Invalid code or password' }, { status: 401 })
    }
    if (!verifyPassword(password, affiliate.password_hash)) {
      return NextResponse.json({ error: 'Invalid code or password' }, { status: 401 })
    }
    const token = signToken({ affiliateId: affiliate.id, code: affiliate.code, name: affiliate.name })
    const res = NextResponse.json({ ok: true })
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    })
    return res
  } catch (e) {
    return NextResponse.json({ error: 'Server error', detail: e?.message || String(e) }, { status: 500 })
  }
}
