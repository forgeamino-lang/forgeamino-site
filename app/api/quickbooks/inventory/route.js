import { NextResponse } from 'next/server'
import { getAccessToken } from '../../../../lib/quickbooks'

const BASE_URL =
  process.env.QBO_ENVIRONMENT === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com'

export async function GET() {
  try {
    if (!process.env.QBO_REFRESH_TOKEN || !process.env.QBO_REALM_ID) {
      return NextResponse.json({ error: 'QuickBooks not configured' }, { status: 503 })
    }

    const accessToken = await getAccessToken()
    const realmId = process.env.QBO_REALM_ID

    const query = "SELECT * FROM Item WHERE Active = true ORDER BY Name"
    const url = `${BASE_URL}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`

    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })

    const data = await resp.json()
    if (!resp.ok) {
      return NextResponse.json({ error: data }, { status: 500 })
    }

    const items = (data.QueryResponse?.Item || []).map(item => ({
      name: item.Name,
      type: item.Type,
      qty_on_hand: item.QtyOnHand ?? null,
      unit_price: item.UnitPrice ?? null,
      purchase_cost: item.PurchaseCost ?? null,
      description: item.Description || '',
      sku: item.Sku || '',
      active: item.Active,
    }))

    return NextResponse.json({
      items,
      total_items: items.length,
      fetched_at: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
