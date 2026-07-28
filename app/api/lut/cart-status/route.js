import { NextResponse } from 'next/server'

// Proxies Lut Turbo's getCartPaymentStatus endpoint. Called by the checkout
// page after the PayByBank widget closes, to fetch the payToken needed to
// complete the transaction.
//
// GET /api/lut/cart-status?sessionId=...&cartId=...

const LUT_BASE_URL = process.env.LUT_BASE_URL || 'https://turbo-myportal.demo.mylut.com/backend'
const LUT_API_KEY = process.env.LUT_API_KEY

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    if (!LUT_API_KEY) {
      return NextResponse.json({ error: 'Lut Turbo is not configured (missing LUT_API_KEY)' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const cartId = searchParams.get('cartId')
    if (!sessionId || !cartId) {
      return NextResponse.json({ error: 'Missing sessionId or cartId' }, { status: 400 })
    }

    const url = `${LUT_BASE_URL}/ecommerce/getCartPaymentStatus?sessionId=${encodeURIComponent(sessionId)}&cartId=${encodeURIComponent(cartId)}`
    const lutResp = await fetch(url, {
      headers: { 'API-KEY': LUT_API_KEY },
      cache: 'no-store',
    })
    const lutJson = await lutResp.json()

    if (lutJson.response !== 1) {
      return NextResponse.json({
        error: lutJson.responseText || 'Lut Turbo status check failed',
        lutResponseCode: lutJson.responseCode,
      }, { status: 502 })
    }

    const obj = lutJson.responseObject || {}
    // Only forward what the client needs -- do not leak anything extra.
    return NextResponse.json({
      sessionStatus: obj.sessionStatus,
      isSessionExpired: obj.isSessionExpired,
      payTokenStatus: obj.payTokenStatus,
      payToken: obj.payToken,
      isTokenExpired: obj.isTokenExpired,
      merchantId: obj.merchantId,
      achAccountLast4: obj.achAccountLast4,
      achRoutingLast4: obj.achRoutingLast4,
      isBusiness: obj.isBusiness,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('Lut cart-status proxy error:', e)
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
