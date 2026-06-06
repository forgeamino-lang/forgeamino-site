import { NextResponse } from 'next/server'
import { COOKIE_NAME } from '../../../../lib/affiliate-auth'

export async function POST(req) {
  const host = req.headers.get('host') || 'www.forgeamino.com'
  const proto = host.includes('localhost') ? 'http' : 'https'
  const res = NextResponse.redirect(proto + '://' + host + '/affiliates')
  res.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' })
  return res
}
