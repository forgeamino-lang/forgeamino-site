import { sendAdminOrderAlert } from './email'
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

export async function getAccessToken() {
      const refreshToken = process.env.QBO_REFRESH_TOKEN
      if (!refreshToken) throw new Error('QBO_REFRESH_TOKEN not set')
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
      if (!response.ok) throw new Error(`Failed to refresh QBO token: ${await response.text()}`)
      const data = await response.json()
      if (data.refresh_token && data.refresh_token !== refreshToken) {
              persistRefreshToken(data.refresh_token).catch(e =>
                        console.error('QBO token rotation: failed to save new refresh token:', e.message)
                                                                )
      }
      return data.access_token
}

async function persistRefreshToken(newRefreshToken) {
      const vercelToken = process.env.VERCEL_ACCESS_TOKEN
      if (!vercelToken) {
              console.warn('QBO token rotation: VERCEL_ACCESS_TOKEN not set, skipping auto-save')
              return
      }
      const projectId = 'forgeamino-site'
      const teamSlug = 'forgeamino-langs-projects'
      const listRes = await fetch(
              `https://api.vercel.com/v9/projects/${projectId}/env?teamSlug=${teamSlug}`,
          { headers: { Authorization: `Bearer ${vercelToken}` } }
            )
      if (!listRes.ok) throw new Error(`Vercel list env failed: ${listRes.status}`)
      const listData = await listRes.json()
      const envVar = listData.envs?.find(e => e.key === 'QBO_REFRESH_TOKEN')
      if (!envVar) throw new Error('QBO_REFRESH_TOKEN not found in Vercel env vars')
      const patchRes = await fetch(
              `https://api.vercel.com/v9/projects/${projectId}/env/${envVar.id}?teamSlug=${teamSlug}`,
          {
                    method: 'PATCH',
                    headers: {
                                Authorization: `Bearer ${vercelToken}`,
                                'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ value: newRefreshToken }),
          }
            )
      if (!patchRes.ok) throw new Error(`Vercel patch env failed: ${patchRes.status}`)
      console.log('QBO token rotation: new refresh token saved to Vercel successfully')
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
            }

      // AST (Automated Sales Tax) is on for this QBO account. Lines are marked
      // with TaxCodeRef: { value: 'TAX' } so QBO computes tax from the ship-to
      // address and posts it to the sales tax liability account automatically.

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
