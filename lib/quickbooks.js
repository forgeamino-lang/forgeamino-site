import { createServerClient } from './supabase'
import { sendAdminOrderAlert } from './email'
import * as Sentry from '@sentry/nextjs'
const QBO_CLIENT_ID = process.env.QBO_CLIENT_ID
const QBO_CLIENT_SECRET = process.env.QBO_CLIENT_SECRET
const QBO_REDIRECT_URI = process.env.QBO_REDIRECT_URI
const QBO_ENVIRONMENT = process.env.QBO_ENVIRONMENT || 'sandbox'

const BASE_URL =
      QBO_ENVIRONMENT === 'production'
    ? 'https://quickbooks.api.intuit.com'
        : 'https://sandbox-quickbooks.api.intuit.com'

const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
const AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2'

export function getAuthUrl() {
      const params = new URLSearchParams({
              client_id: QBO_CLIENT_ID,
              response_type: 'code',
              scope: 'com.intuit.quickbooks.accounting',
              redirect_uri: QBO_REDIRECT_URI,
              state: 'forge-amino-qbo-auth',
      })
      return `${AUTH_URL}?${params.toString()}`
}

export async function exchangeCodeForTokens(code) {
      const credentials = Buffer.from(`${QBO_CLIENT_ID}:${QBO_CLIENT_SECRET}`).toString('base64')
      const response = await fetch(TOKEN_URL, {
              method: 'POST',
              headers: {
                        Authorization: `Basic ${credentials}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                        Accept: 'application/json',
              },
              body: new URLSearchParams({
                        grant_type: 'authorization_code',
                        code,
                        redirect_uri: QBO_REDIRECT_URI,
              }),
      })
      if (!response.ok) throw new Error(`Token exchange failed: ${await response.text()}`)
      return response.json()
}

// ────────────────────────────────────────────────────────────────────────
// QBO OAuth token management — Supabase as shared source of truth.
//
// Why Supabase and not env vars: every Vercel lambda has its own snapshot
// of process.env, captured at cold start. When Lambda A rotates the
// refresh token at Intuit and Lambda B is already warm, B's env snapshot
// is stale. Storing the token in Supabase means all lambdas (warm or
// cold) read from the same row.
//
// Access token cache: Intuit access tokens are valid ~1hr. We cache in
// module memory and only refresh on expiry. This shrinks the multi-lambda
// rotation race from "once per order" to "once per hour per lambda".
// ────────────────────────────────────────────────────────────────────────

let cachedAccessToken = null
let cachedAccessExpiry = 0  // unix ms; 0 means no cache
let inflightRefresh = null

async function readRefreshTokenFromSupabase() {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('secrets')
    .select('value')
    .eq('key', 'qbo_refresh_token')
    .maybeSingle()
  if (error) throw new Error(`Supabase read of qbo_refresh_token failed: ${error.message}`)
  // Bootstrap from env if Supabase row hasn't been seeded yet.
  return data?.value || process.env.QBO_REFRESH_TOKEN || null
}

async function writeRefreshTokenToSupabase(token) {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('secrets')
    .upsert(
      { key: 'qbo_refresh_token', value: token, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
  if (error) throw new Error(`Supabase write of qbo_refresh_token failed: ${error.message}`)
}

export async function getAccessToken() {
  // Fast path: cached access token still valid (with 60s safety buffer).
  if (cachedAccessToken && Date.now() < cachedAccessExpiry - 60_000) {
    return cachedAccessToken
  }
  // De-dupe concurrent refreshes on the same warm lambda.
  if (inflightRefresh) return inflightRefresh

  inflightRefresh = (async () => {
    try {
      const refreshToken = await readRefreshTokenFromSupabase()
      if (!refreshToken) {
        throw new Error('No QBO refresh token in Supabase secrets table or env')
      }

      const credentials = Buffer.from(`${QBO_CLIENT_ID}:${QBO_CLIENT_SECRET}`).toString('base64')
      const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      })
      if (!response.ok) {
        throw new Error(`Failed to refresh QBO token: ${await response.text()}`)
      }
      const data = await response.json()

      // Cache the access token so subsequent calls within the next ~hour
      // skip the refresh entirely.
      cachedAccessToken = data.access_token
      cachedAccessExpiry = Date.now() + (Number(data.expires_in) || 3600) * 1000

      // Persist the rotated refresh token to Supabase. All other warm
      // lambdas will pick this up on their next refresh because they
      // all read from the same row.
      if (data.refresh_token && data.refresh_token !== refreshToken) {
        try {
          await writeRefreshTokenToSupabase(data.refresh_token)
        } catch (e) {
          console.error('QBO token rotation: failed to persist new refresh token to Supabase:', e.message)
          try {
            Sentry.captureException(e, {
              tags: { feature: 'qbo-token-rotation', severity: 'high' },
              extra: { message: e.message },
            })
          } catch (_) {
            // Sentry unavailable — console.error above is our fallback
          }
        }
      }

      return data.access_token
    } finally {
      inflightRefresh = null
    }
  })()

  return inflightRefresh
}

export async function findOrCreateCustomer(accessToken, realmId, { name, email, phone, address }) {
      // 1. Try lookup by email
  if (email) {
          const emailQuery = `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${email.replace(/'/g, "\\'")}' MAXRESULTS 1`
          const emailRes = await fetch(
                    `${BASE_URL}/v3/company/${realmId}/query?query=${encodeURIComponent(emailQuery)}&minorversion=65`,
              { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } }
                  )
          const emailData = await emailRes.json()
          const byEmail = emailData?.QueryResponse?.Customer?.[0]
          if (byEmail) return byEmail
  }

  // 2. Try lookup by DisplayName
  if (name) {
          const nameQuery = `SELECT * FROM Customer WHERE DisplayName = '${name.replace(/'/g, "\\'")}' MAXRESULTS 1`
          const nameRes = await fetch(
                    `${BASE_URL}/v3/company/${realmId}/query?query=${encodeURIComponent(nameQuery)}&minorversion=65`,
              { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } }
                  )
          const nameData = await nameRes.json()
          const byName = nameData?.QueryResponse?.Customer?.[0]
          if (byName) return byName
  }

  // 3. Try to create
  const payload = {
          DisplayName: name,
          PrimaryEmailAddr: { Address: email },
          ...(phone ? { PrimaryPhone: { FreeFormNumber: phone } } : {}),
          ...(address ? {
                    BillAddr: {
                                Line1: address.line1 || address.address || address.street || '',
                                City: address.city || '',
                                CountrySubDivisionCode: address.state || '',
                                PostalCode: address.zip || address.postal_code || '',
                                Country: 'US',
                    },
          } : {}),
  }
      const createRes = await fetch(
              `${BASE_URL}/v3/company/${realmId}/customer?minorversion=65`,
          {
                    method: 'POST',
                    headers: {
                                Authorization: `Bearer ${accessToken}`,
                                'Content-Type': 'application/json',
                                Accept: 'application/json',
                    },
                    body: JSON.stringify(payload),
          }
            )
      const createData = await createRes.json()

  // 4. On duplicate name error (code 6240), fall back to fetching by name
  if (!createRes.ok) {
          const isDuplicate = createData?.Fault?.Error?.some(e => e.code === '6240')
          if (isDuplicate && name) {
                    const fallbackQuery = `SELECT * FROM Customer WHERE DisplayName = '${name.replace(/'/g, "\\'")}' MAXRESULTS 1`
                    const fallbackRes = await fetch(
                                `${BASE_URL}/v3/company/${realmId}/query?query=${encodeURIComponent(fallbackQuery)}&minorversion=65`,
                        { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } }
                              )
                    const fallbackData = await fallbackRes.json()
                    const existing = fallbackData?.QueryResponse?.Customer?.[0]
                    if (existing) return existing
          }
          throw new Error(`Failed to create QBO customer: ${JSON.stringify(createData)}`)
  }

  return createData.Customer
}

export async function fetchQboItems(accessToken, realmId) {
  const query = 'SELECT * FROM Item MAXRESULTS 1000'
  const url = `${BASE_URL}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`
  const resp = await fetch(url, {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })
  const data = await resp.json()
  if (!resp.ok) {
    throw new Error(`QBO item query failed: ${JSON.stringify(data).slice(0, 200)}`)
  }
  const byName = new Map()
  for (const it of data?.QueryResponse?.Item || []) {
    if (it.Active !== false) byName.set(it.Name, it)
  }
  return byName
}

async function createInvoice(accessToken, realmId, { customer, order }) {
      const qboItemsByName = await fetchQboItems(accessToken, realmId)
      const fallbackItem = qboItemsByName.get('Services')
      const unmatchedNames = []

      const lines = (order.line_items || []).map((item, idx) => {
        // Lab products carry a separate qbo_name so the website can show a
        // friendlier display name while the QBO inventory lookup still maps
        // to the canonical SKU (and stock decrements correctly).
        const invName = item.qbo_name || item.name
        const matched = qboItemsByName.get(invName)
        if (!matched) unmatchedNames.push(invName)
        const ref = matched
          ? { value: matched.Id, name: matched.Name }
          : fallbackItem
            ? { value: fallbackItem.Id, name: fallbackItem.Name }
            : undefined
        return {
          Id: String(idx + 1),
          Amount: parseFloat((item.price * item.quantity).toFixed(2)),
          DetailType: 'SalesItemLineDetail',
          Description: invName,
          SalesItemLineDetail: {
            ...(ref ? { ItemRef: ref } : {}),
            Qty: item.quantity,
            UnitPrice: item.price,
            TaxCodeRef: { value: 'TAX' },
          },
        }
      })
      // Append a non-taxable shipping line when shipping_amount > 0. Uses a
      // dedicated 'Shipping' QBO Item if one exists, else falls back to Services.
      const shippingAmount = Number(order.shipping_amount || 0)
      if (shippingAmount > 0) {
        const shippingMethodLabel = order.shipping_method === 'local_delivery'
          ? 'Local Delivery'
          : 'FedEx 2-Day'
        const shippingItem = qboItemsByName.get('Shipping') || fallbackItem
        lines.push({
          Id: String(lines.length + 1),
          Amount: parseFloat(shippingAmount.toFixed(2)),
          DetailType: 'SalesItemLineDetail',
          Description: `Shipping (${shippingMethodLabel})`,
          SalesItemLineDetail: {
            ...(shippingItem ? { ItemRef: { value: shippingItem.Id, name: shippingItem.Name } } : {}),
            Qty: 1,
            UnitPrice: parseFloat(shippingAmount.toFixed(2)),
            TaxCodeRef: { value: 'NON' },
          },
        })
      }

      const addr = order.shipping_address || {}
      const basePrivateNote = `Order #${order.order_number} | Payment: ${order.payment_method || 'card'}`
      const privateNote = unmatchedNames.length
        ? `${basePrivateNote} | Unmatched items (fell back to Services): ${unmatchedNames.join(', ')}`
        : basePrivateNote
            // Pull the tax we computed at checkout. Orders carry tax fields
            // either on the top-level order (fresh from /api/orders/route.js)
            // or nested in shipping_address JSONB (Supabase-loaded orders
            // re-synced via syncToQuickBooks). Accept both shapes.
            const shipAddrForTax = order.shipping_address || {}
            const taxAmount = Number(order.tax_amount ?? shipAddrForTax.tax_amount ?? 0)

            const payload = {
                    CustomerRef: { value: customer.Id },
                    DocNumber: order.order_number?.toString().slice(0, 21),
                    Line: lines,
                    BillEmail: { Address: order.customer_email },
                    ShipAddr: {
                              Line1: addr.line1 || addr.address || addr.street || '',
                              City: addr.city || '',
                              CountrySubDivisionCode: addr.state || '',
                              PostalCode: addr.zip || addr.postal_code || '',
                              Country: 'US',
                    },
                    CustomerMemo: { value: `Forge Amino Order #${order.order_number}` },
                    PrivateNote: privateNote,
                    // Tax override. For states NOT configured in the QBO Sales
                    // Tax Center (common when shipping to states outside our
                    // nexus), AST silently returns $0 even for taxable lines.
                    // We already computed the correct tax via /api/tax-rate, so
                    // send it as an explicit override. Per Intuit docs,
                    // TxnTaxDetail.TotalTax combined with GlobalTaxCalculation:
                    // 'TaxExcluded' is the documented path to override AST.
                    ...(taxAmount > 0 ? {
                              GlobalTaxCalculation: 'TaxExcluded',
                              TxnTaxDetail: { TotalTax: taxAmount },
                    } : {}),
            }

      // Tax: we compute it site-side via /api/tax-rate and send it to QBO
      // as an explicit TxnTaxDetail.TotalTax override (see payload below).
      // AST alone would return $0 for states not configured in the QBO Sales
      // Tax Center, silently under-recording collected tax. Line items still
      // carry TaxCodeRef: 'TAX' so AST can fall back to computing when we
      // don't provide a tax_amount (zero-tax jurisdictions, re-synced legacy
      // orders missing tax fields).

      const response = await fetch(
              `${BASE_URL}/v3/company/${realmId}/invoice?minorversion=65`,
          {
                    method: 'POST',
                    headers: {
                                Authorization: `Bearer ${accessToken}`,
                                'Content-Type': 'application/json',
                                Accept: 'application/json',
                    },
                    body: JSON.stringify(payload),
          }
            )
      const data = await response.json()
      if (!response.ok) throw new Error(`Failed to create QBO invoice: ${JSON.stringify(data)}`)
      return data.Invoice
}

async function fetchInvoicePdf(accessToken, realmId, invoiceId) {
  const url = `${BASE_URL}/v3/company/${realmId}/invoice/${invoiceId}/pdf?minorversion=65`
  const resp = await fetch(url, {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/pdf',
    },
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`QBO PDF fetch failed: ${resp.status} ${text.slice(0, 200)}`)
  }
  const buf = await resp.arrayBuffer()
  return Buffer.from(buf).toString('base64')
}

export async function syncToQuickBooks(order) {
  const realmId = process.env.QBO_REALM_ID
  if (!realmId) throw new Error('QBO_REALM_ID not set')

  // Normalize tax fields — orders loaded from Supabase carry tax_amount / tax_rate / subtotal
  // nested inside shipping_address JSONB (schema kept tax off the top-level orders table).
  const shipAddr = order.shipping_address || {}
  const normalized = {
    ...order,
    tax_amount:      order.tax_amount      ?? shipAddr.tax_amount      ?? 0,
    tax_rate:        order.tax_rate        ?? shipAddr.tax_rate        ?? 0,
    subtotal:        order.subtotal        ?? shipAddr.subtotal        ?? null,
    shipping_amount: order.shipping_amount ?? shipAddr.shipping_amount ?? 0,
    shipping_method: order.shipping_method ?? shipAddr.shipping_method ?? null,
  }

  const accessToken = await getAccessToken()
  const customer = await findOrCreateCustomer(accessToken, realmId, {
    name: normalized.customer_name,
    email: normalized.customer_email,
    phone: normalized.customer_phone,
    address: normalized.shipping_address,
  })
  const invoice = await createInvoice(accessToken, realmId, { customer, order: normalized })

  // Fetch the QBO invoice PDF and email it to Angela (non-fatal on failure).
  try {
    const invoiceId = invoice?.Id || invoice?.invoice?.Id
    if (invoiceId) {
      const pdfBase64 = await fetchInvoicePdf(accessToken, realmId, invoiceId)
      const invoiceForEmail = invoice?.invoice || invoice
      await sendAdminOrderAlert(order, invoiceForEmail, pdfBase64)
    } else {
      console.error('QBO invoice missing Id; skipping admin PDF email', { order_number: order.order_number })
    }
  } catch (e) {
    console.error('Admin invoice PDF email failed:', { order_number: order.order_number, error: e?.message || String(e) })
  }

  return invoice
}
