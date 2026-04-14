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

export async function createInvoice(accessToken, realmId, { customer, order }) {
      const lines = (order.line_items || []).map((item, idx) => ({
              Id: String(idx + 1),
              Amount: parseFloat((item.price * item.quantity).toFixed(2)),
              DetailType: 'SalesItemLineDetail',
              Description: item.name,
              SalesItemLineDetail: { Qty: item.quantity, UnitPrice: item.price },
      }))
      if (order.tax_amount && order.tax_amount > 0) {
              lines.push({
                        Id: String(lines.length + 1),
                        Amount: parseFloat(order.tax_amount.toFixed(2)),
                        DetailType: 'SalesItemLineDetail',
                        Description: `Sales Tax (${((order.tax_rate || 0) * 100).toFixed(2)}%)`,
                        SalesItemLineDetail: { Qty: 1, UnitPrice: order.tax_amount },
              })
      }
      const addr = order.shipping_address || {}
            const payload = {
                    CustomerRef: { value: customer.Id },
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
                    PrivateNote: `Order #${order.order_number} | Payment: ${order.payment_method || 'card'}`,
            }
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

export async function syncToQuickBooks(order) {
      const realmId = process.env.QBO_REALM_ID
      if (!realmId) throw new Error('QBO_REALM_ID not set')
      const accessToken = await getAccessToken()
      const customer = await findOrCreateCustomer(accessToken, realmId, {
              name: order.customer_name,
              email: order.customer_email,
              phone: order.customer_phone,
              address: order.shipping_address,
      })
      const invoice = await createInvoice(accessToken, realmId, { customer, order })
      return invoice
}
