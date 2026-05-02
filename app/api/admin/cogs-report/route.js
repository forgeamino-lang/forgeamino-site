import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../../lib/adminAuth'
import { getAccessToken } from '../../../../lib/quickbooks'

// Pull every QBO Item's PurchaseCost, then walk every Invoice in a date
// range and compute COGS = sum(line.qty * item.PurchaseCost) per month.
//
// Used by the affiliate-commission scenario model so we can compare the
// realised cost-of-goods to gross revenue without hand-entering numbers
// from the QBO P&L.
//
// Auth: Authorization: Bearer <ADMIN_PASSWORD>  OR  ?key=<ADMIN_PASSWORD>
//
// GET /api/admin/cogs-report?since=2026-02-01&until=2026-04-30

const BASE_URL =
  process.env.QBO_ENVIRONMENT === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com'

export const dynamic = 'force-dynamic'

async function qboQuery(accessToken, realmId, query) {
  const url =
    `${BASE_URL}/v3/company/${realmId}/query?query=` +
    encodeURIComponent(query) +
    '&minorversion=65'
  const resp = await fetch(url, {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })
  const data = await resp.json()
  if (!resp.ok) {
    throw new Error(`QBO query failed (${resp.status}): ${JSON.stringify(data)}`)
  }
  return data.QueryResponse || {}
}

export async function GET(request) {
  const unauthorized = requireAdmin(request)
  if (unauthorized) return unauthorized

  const url = new URL(request.url)
  const since = url.searchParams.get('since') || '2026-02-01'
  const until = url.searchParams.get('until') || '2026-04-30'

  if (!process.env.QBO_REALM_ID) {
    return NextResponse.json(
      { error: 'QBO_REALM_ID not configured' },
      { status: 503 }
    )
  }

  try {
    const accessToken = await getAccessToken()
    const realmId = process.env.QBO_REALM_ID

    // 1) Pull all items so we can build a cost map keyed by Id
    const itemsResp = await qboQuery(
      accessToken,
      realmId,
      'SELECT * FROM Item MAXRESULTS 1000'
    )
    const items = itemsResp.Item || []
    const costById = new Map()
    const itemDirectory = items.map(it => ({
      id: it.Id,
      name: it.Name,
      type: it.Type,
      purchase_cost: it.PurchaseCost ?? null,
      unit_price: it.UnitPrice ?? null,
      active: it.Active !== false,
    }))
    for (const it of items) {
      if (it.PurchaseCost != null) {
        costById.set(it.Id, {
          name: it.Name,
          cost: parseFloat(it.PurchaseCost),
        })
      }
    }

    // 2) Pull all invoices in date range
    const invQuery =
      `SELECT * FROM Invoice WHERE TxnDate >= '${since}' AND TxnDate <= '${until}' MAXRESULTS 1000`
    const invResp = await qboQuery(accessToken, realmId, invQuery)
    const invoices = invResp.Invoice || []

    // 3) Walk lines, accumulate COGS by month
    const byMonth = {}
    const uncosted = []
    let totalCogs = 0
    let totalLines = 0

    for (const inv of invoices) {
      const month = (inv.TxnDate || '').slice(0, 7) // YYYY-MM
      if (!byMonth[month]) {
        byMonth[month] = {
          invoices: 0,
          gross: 0,
          cogs: 0,
          lines_costed: 0,
          lines_uncosted: 0,
        }
      }
      byMonth[month].invoices += 1
      byMonth[month].gross += parseFloat(inv.TotalAmt || 0)

      for (const line of inv.Line || []) {
        if (line.DetailType !== 'SalesItemLineDetail') continue
        totalLines += 1
        const detail = line.SalesItemLineDetail
        const itemId = detail?.ItemRef?.value
        const qty = parseFloat(detail?.Qty || 0)
        const itemCost = costById.get(itemId)

        if (itemCost && qty > 0) {
          const lineCogs = itemCost.cost * qty
          byMonth[month].cogs += lineCogs
          byMonth[month].lines_costed += 1
          totalCogs += lineCogs
        } else {
          byMonth[month].lines_uncosted += 1
          uncosted.push({
            invoice: inv.DocNumber || inv.Id,
            date: inv.TxnDate,
            item_id: itemId,
            item_name: detail?.ItemRef?.name,
            qty,
            amount: parseFloat(line.Amount || 0),
            reason: !itemId
              ? 'no ItemRef'
              : !itemCost
              ? 'item has no PurchaseCost in QBO'
              : 'qty <= 0',
          })
        }
      }
    }

    return NextResponse.json({
      since,
      until,
      total_invoices: invoices.length,
      total_lines: totalLines,
      total_cogs: Number(totalCogs.toFixed(2)),
      by_month: Object.fromEntries(
        Object.entries(byMonth).map(([k, v]) => [
          k,
          {
            invoices: v.invoices,
            gross: Number(v.gross.toFixed(2)),
            cogs: Number(v.cogs.toFixed(2)),
            gross_profit: Number((v.gross - v.cogs).toFixed(2)),
            gp_margin_pct:
              v.gross > 0 ? Number(((v.gross - v.cogs) / v.gross * 100).toFixed(1)) : null,
            lines_costed: v.lines_costed,
            lines_uncosted: v.lines_uncosted,
          },
        ])
      ),
      uncosted_lines: uncosted.length,
      uncosted_sample: uncosted.slice(0, 50),
      cost_map: itemDirectory,
      fetched_at: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { error: err.message, stack: err.stack },
      { status: 500 }
    )
  }
}
