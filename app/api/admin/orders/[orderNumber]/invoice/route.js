import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../../../../lib/adminAuth'
import { getAccessToken, fetchInvoicePdf } from '../../../../../../lib/quickbooks'

// GET /api/admin/orders/FA-7019/invoice?key=ADMIN_PASSWORD
//
// Looks up the QBO Invoice for this order_number (DocNumber match), then
// streams the PDF inline so the browser displays it in a new tab.
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0
export const runtime = 'nodejs'

const QBO_ENVIRONMENT = process.env.QBO_ENVIRONMENT || 'sandbox'
const BASE_URL =
  QBO_ENVIRONMENT === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com'

export async function GET(request, { params }) {
  const unauthorized = requireAdmin(request)
  if (unauthorized) return unauthorized

  const orderNumber = params?.orderNumber
  if (!orderNumber) {
    return NextResponse.json({ ok: false, error: 'Missing orderNumber' }, { status: 400 })
  }

  try {
    const realmId = process.env.QBO_REALM_ID
    if (!realmId) throw new Error('QBO_REALM_ID not set')

    const accessToken = await getAccessToken()

    // QBO query language uses single quotes around literals; escape any in the
    // doc number just in case (FA-#### shouldn't have any, but be safe).
    const escaped = orderNumber.replace(/'/g, "\\'")
    const query = `SELECT Id, DocNumber, TotalAmt FROM Invoice WHERE DocNumber = '${escaped}'`
    const queryUrl = `${BASE_URL}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`

    const queryResp = await fetch(queryUrl, {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })
    if (!queryResp.ok) {
      const t = await queryResp.text().catch(() => '')
      throw new Error(`QBO invoice lookup failed: ${queryResp.status} ${t.slice(0, 200)}`)
    }
    const queryJson = await queryResp.json()
    const invoice = queryJson?.QueryResponse?.Invoice?.[0]
    if (!invoice?.Id) {
      return NextResponse.json(
        { ok: false, error: `No QBO invoice found for ${orderNumber}` },
        { status: 404 },
      )
    }

    const pdfBase64 = await fetchInvoicePdf(accessToken, realmId, invoice.Id)
    const pdfBuf = Buffer.from(pdfBase64, 'base64')

    return new NextResponse(pdfBuf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${orderNumber}.pdf"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        order_number: orderNumber,
        error: e?.message || String(e),
      },
      { status: 500 },
    )
  }
}
