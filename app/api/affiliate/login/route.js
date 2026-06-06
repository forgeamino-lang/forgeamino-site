import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyPassword, signToken, COOKIE_NAME, COOKIE_MAX_AGE } from '../../../../lib/affiliate-auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(req) {
  try {
    const { code, password } = await req.json()
    if (!code || !password) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const { data: affiliate } = await supabase
      .from('affiliates')
      .select('id, code, name, commission_rate, password_hash, active')
      .eq('code', code.trim().toUpperCase())
      .maybeSingle()

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
      maxAge: COKIE_MAX_AGE,
      path: '/',
    })
    return res
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
