import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../../lib/adminAuth'
import { getAccessToken } from '../../../../lib/quickbooks'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0
export const runtime = 'nodejs'
export const maxDuration = 60

const BASE_URL =
  process.env.QBO_ENVIRONMENT === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com'

async function qboFetch(realmId, token, q) {
  const url = `${BASE_URL}/v3/company/${realmId}/query?query=${encodeURIComponent(q)}&minorversion=65`
  const r = await fetch(url, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  const t = await r.text()
  if (!r.ok) throw new Error(`QBO query ${r.status}: ${t.slice(0, 400)}`)
  return JSON.parse(t)
}

export async function GET(request) {
  const unauthorized = requireAdmin(request)
  if (unauthorized) return unauthorized
  const realmId = process.env.QBO_REALM_ID
  if (!realmId) return NextResponse.json({ ok: false, error: 'QBO_REALM_ID not set' }, { status: 500 })
  const token = await getAccessToken()

  // Fetch all items in batches (QBO max 1000)
  let start = 1, all = []
  while (true) {
    const j = await qboFetch(realmId, token, `SELECT * FROM Item STARTPOSITION ${start} MAXRESULTS 100`)
    const items = j?.QueryResponse?.Item || []
    all = all.concat(items)
    if (items.length < 100) break
    start += 100
    if (start > 5000) break
  }

  // Compute per-item perpetual value: QtyOnHand × PurchaseCost
  const rows = all
    .filter(i => i.Type === 'Inventory')
    .map(i => {
      const qty   = Number(i.QtyOnHand || 0)
      const cost  = Number(i.PurchaseCost || 0)
      const value = qty * cost
      return {
        name: i.Name,
        sku: i.Sku || null,
        qty,
        purchase_cost: cost,
        value,
        active: i.Active !== false,
        income_account: i.IncomeAccountRef?.name || null,
        asset_account:  i.AssetAccountRef?.name  || null,
        cogs_account:   i.ExpenseAccountRef?.name || null,
      }
    })
    .sort((a, b) => b.value - a.value)

  const perpetualTotal   = rows.reduce((s, r) => s + r.value, 0)
  const itemsWithoutCost = rows.filter(r => r.qty > 0 && r.purchase_cost === 0)
  const itemsWithoutQty  = rows.filter(r => r.qty === 0)

  // The book balance of Inventory Asset is what we got from chart-of-accounts (96,888.30).
  // Difference = manual entries posted to the account that aren't tied to items
  // (e.g., the 13 PO Category Detail expenses we just booked).
  const BOOK_BALANCE_HARDCODED = 96888.30
  const PO_BACKFILL = 51336.10

  return NextResponse.json({
    ok: true,
    summary: {
      perpetual_total:           Number(perpetualTotal.toFixed(2)),
      book_balance:              BOOK_BALANCE_HARDCODED,
      delta_unattributed:        Number((BOOK_BALANCE_HARDCODED - perpetualTotal).toFixed(2)),
      po_backfill_today:         PO_BACKFILL,
      items_count:               rows.length,
      items_active:              rows.filter(r => r.active).length,
      items_with_qty_no_cost:    itemsWithoutCost.length,
      items_at_zero_qty:         itemsWithoutQty.length,
    },
    items_by_value: rows,
    items_with_qty_no_cost: itemsWithoutCost.map(r => ({ name: r.name, qty: r.qty })),
  })
}
