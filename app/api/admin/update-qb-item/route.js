import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../../lib/adminAuth'
import { getAccessToken } from '../../../../lib/quickbooks'

const BASE_URL =
  process.env.QBO_ENVIRONMENT === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com'

// POST body: { id?, current_name?, name?, unit_price? }
// Must provide id or current_name. Must provide name and/or unit_price.
export async function POST(request) {
  const unauthorized = requireAdmin(request)
  if (unauthorized) return unauthorized

  let body
  try {
    body = await request.json()
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { id, current_name, name, unit_price } = body

  if (!id && !current_name) {
    return NextResponse.json(
      { error: 'Provide either id or current_name to locate the item' },
      { status: 400 }
    )
  }
  if (name == null && unit_price == null) {
    return NextResponse.json(
      { error: 'Provide name and/or unit_price to update' },
      { status: 400 }
    )
  }

  try {
    const accessToken = await getAccessToken()
    const realmId = process.env.QBO_REALM_ID
    const baseHeaders = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    }

    // Resolve the item (we need current SyncToken for sparse update)
    let item
    if (id) {
      const r = await fetch(
        `${BASE_URL}/v3/company/${realmId}/item/${id}?minorversion=65`,
        { headers: baseHeaders }
      )
      const j = await r.json()
      if (!r.ok || !j.Item) {
        return NextResponse.json(
          { error: 'Item not found by id', details: j },
          { status: 404 }
        )
      }
      item = j.Item
    } else {
      const safe = current_name.replace(/'/g, "''")
      const query = `SELECT * FROM Item WHERE Name = '${safe}'`
      const r = await fetch(
        `${BASE_URL}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`,
        { headers: baseHeaders }
      )
      const j = await r.json()
      const items = j?.QueryResponse?.Item || []
      if (items.length === 0) {
        return NextResponse.json(
          { error: `No item with name '${current_name}'` },
          { status: 404 }
        )
      }
      if (items.length > 1) {
        return NextResponse.json(
          {
            error: `Multiple items match '${current_name}'`,
            matches: items.map((i) => ({ id: i.Id, name: i.Name })),
          },
          { status: 409 }
        )
      }
      item = items[0]
    }

    const update = {
      Id: item.Id,
      SyncToken: item.SyncToken,
      sparse: true,
    }
    if (name != null) update.Name = name
    if (unit_price != null) update.UnitPrice = parseFloat(unit_price)

    const postResp = await fetch(
      `${BASE_URL}/v3/company/${realmId}/item?minorversion=65`,
      {
        method: 'POST',
        headers: { ...baseHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      }
    )
    const postData = await postResp.json()
    if (!postResp.ok) {
      return NextResponse.json(
        { error: 'Failed to update item', details: postData },
        { status: 502 }
      )
    }

    return NextResponse.json({
      ok: true,
      id: item.Id,
      before: { name: item.Name, unit_price: item.UnitPrice },
      after: {
        name: postData.Item?.Name,
        unit_price: postData.Item?.UnitPrice,
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
