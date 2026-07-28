import { NextResponse } from 'next/server'

// Proxies Lut Turbo's createSession endpoint. The API key never reaches the
// browser -- this route holds it server-side and the client only ever sees
// the sessionId/cartId it returns.
//
// POST /api/lut/create-session   body: { cartId }

const LUT_BASE_URL = process.env.LUT_BASE_URL || 'https://turbo-myportal.demo.mylut.com/backend'
const LUT_API_KEY = process.env.LUT_API_KEY

export async function POST(request) {
  try {
    if (!LUT_API_KEY) {
      return NextResponse.json({ error: 'Lut Turbo is not configured (missing LUT_API_KEY)' }, { status: 500 })
    }

    const { cartId } = await request.json()
    if (!cartId) {
      return NextResponse.json({ error: 'Missing cartId' }, { status: 400 })
    }

    const url = `${LUT_BASE_URL}/ecommerce/createSession?cartId=${encodeURIComponent(cartId)}`
    const lutResp = await fetch(url, {
      method: 'POST',
      headers: { 'API-KEY': LUT_API_KEY },
    })
    const lutJson = await lutResp.json()

    if (lutJson.response !== 1) {
      return NextResponse.json({
        error: lutJson.responseText || 'Lut Turbo session creation failed',
        lutResponseCode: lutJson.responseCode,
      }, { status: 502 })
    }

    return NextResponse.json({
      sessionId: lutJson.responseObject?.sessionId,
      cartId: lutJson.responseObject?.cartId,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('Lut createSession proxy error:', e)
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
