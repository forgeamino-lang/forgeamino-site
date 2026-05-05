import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../../lib/adminAuth'
import { getAccessToken } from '../../../../lib/quickbooks'

// Look up a QBO customer by company / display name and aggregate their
// invoice revenue over a date range. Subtotals exclude shipping and tax.
//
// GET /api/admin/customer-revenue?key=ADMIN_PASSWORD
//   ?company=NAME      case-insensitive substring match against CompanyName + DisplayName
//   ?since=YYYY-MM-DD  default = first day of the current month
//   ?until=YYYY-MM-DD  default = today

const BASE_URL = process.env.QBO_ENVIRONMENT === 'production'
  ? 'https://quickbooks.api.intuit.com'
  : 'https://sandbox-quickbooks.api.intuit.com'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function qboQuery(accessToken, realmId, query) {
  const url = `${BASE_URL}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`
  const r = await fetch(url, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  const data = await r.json()
  if (!r.ok) throw new Error(`QBO ${r.status}: ${JSON.stringify(data)}`)
  return data.QueryResponse || {}
}

export async function GET(request) {
  const unauthorized = requireAdmin(request)
  if (unauthorized) return unauthorized

  const url = new URL(request.url)
  const company = (url.searchParams.get('company') || '').trim()
  if (!company) return NextResponse.json({ error: 'company= required' }, { status: 400 })

  const today = new Date().toISOString().slice(0, 10)
  const since = url.searchParams.get('since') || today.slice(0, 7) + '-01'
  const until = url.searchParams.get('until') || today

  if (!process.env.QBO_REALM_ID) {
    return NextResponse.json({ error: 'QBO_REALM_ID not configured' }, { status: 503 })
  }

  try {
    const accessToken = await getAccessToken()
    const realmId = process.env.QBO_REALM_ID

    // 1) Resolve the company to one or more Customer ids (CompanyName or DisplayName)
    const safe = company.replace(/'/g, "''")
    // QBO query language doesn't support OR, so run two queries and merge
    const [byCompany, byDisplay] = await Promise.all([
      qboQuery(accessToken, realmId, `SELECT Id, DisplayName, CompanyName FROM Customer WHERE CompanyName LIKE '%${safe}%' MAXRESULTS 100`),
      qboQuery(accessToken, realmId, `SELECT Id, DisplayName, CompanyName FROM Customer WHERE DisplayName LIKE '%${safe}%' MAXRESULTS 100`),
    ])
    const seen = new Set()
    const customers = [...(byCompany.Customer || []), ...(byDisplay.Customer || [])].filter(c => {
      if (seen.has(c.Id)) return false
      seen.add(c.Id); return true
    })
    if (customers.length === 0) {
      return NextResponse.json({ company, since, until, customers: [], total_invoices: 0, totals: { gross: 0, subtotal_ex_shipping_tax: 0, tax: 0, shipping: 0 } })
    }

    // 2) Pull every invoice in the range, then filter to those customer ids client-side.
    //    (PostgREST IN clauses against UUIDs over the QBO query language are awkward —
    //    pulling everything in the range and filtering in memory is simpler and fine
    //    for the usual <500 invoice/month volume.)
    const invQ = `SELECT * FROM Invoice WHERE TxnDate >= '${since}' AND TxnDate <= '${until}' MAXRESULTS 1000`
    const invResp = await qboQuery(accessToken, realmId, invQ)
    const allInvoices = invResp.Invoice || []

    const wantedCustIds = new Set(customers.map(c => c.Id))
    const invoices = allInvoices.filter(inv => wantedCustIds.has(inv.CustomerRef?.value))

    // 3) Aggregate. For each invoice, walk Lines:
    //    • SalesItemLineDetail with ItemRef.name == 'Shipping'           → shipping
    //    • SalesItemLineDetail (any other item)                          → product subtotal
    //    • TaxLineDetail / TxnTaxDetail.TotalTax                         → tax
    //    Gross = invoice.TotalAmt
    let totalGross = 0, totalSubtotal = 0, totalShipping = 0, totalTax = 0
    const breakdown = []
    for (const inv of invoices) {
      const gross    = Number(inv.TotalAmt || 0)
      const tax      = Number(inv.TxnTaxDetail?.TotalTax || 0)
      let shipping   = 0
      let subtotal   = 0
      for (const line of inv.Line || []) {
        if (line.DetailType !== 'SalesItemLineDetail') continue
        const name = line.SalesItemLineDetail?.ItemRef?.name || ''
        const amt  = Number(line.Amount || 0)
        if (/^shipping/i.test(name)) shipping += amt
        else                          subtotal += amt
      }
      totalGross    += gross
      totalSubtotal += subtotal
      totalShipping += shipping
      totalTax      += tax
      breakdown.push({
        doc_number:  inv.DocNumber,
        date:        inv.TxnDate,
        customer:    inv.CustomerRef?.name,
        gross,
        subtotal,
        shipping,
        tax,
      })
    }
    breakdown.sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({
      company,
      since,
      until,
      matched_customers: customers.map(c => ({ id: c.Id, display_name: c.DisplayName, company_name: c.CompanyName })),
      total_invoices: invoices.length,
      totals: {
        gross:                    Number(totalGross.toFixed(2)),
        subtotal_ex_shipping_tax: Number(totalSubtotal.toFixed(2)),
        shipping:                 Number(totalShipping.toFixed(2)),
        tax:                      Number(totalTax.toFixed(2)),
      },
      invoices: breakdown,
      fetched_at: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
