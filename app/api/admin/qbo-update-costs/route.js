import { getAccessToken } from '../../../../lib/quickbooks'

const BASE_URL = process.env.QBO_ENVIRONMENT === 'production'
  ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com'

export async function POST(req) {
    try {
          const pwd = req.headers.get('x-admin-password')
          if (pwd !== process.env.ADMIN_PASSWORD) {
                  return Response.json({ error: 'Unauthorized' }, { status: 401 })
          }
          const realmId = process.env.QBO_REALM_ID
          if (!realmId) return Response.json({ error: 'QBO_REALM_ID not set' }, { status: 500 })
          const token = await getAccessToken()
          const { updates } = await req.json()
          const nameList = updates.map(u => "'" + u.name + "'").join(', ')
          const query = `SELECT Id, Name, SyncToken, PurchaseCost FROM Item WHERE Name IN (${nameList})`
          const queryUrl = `${BASE_URL}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`
          const qRes = await fetch(queryUrl, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
          if (!qRes.ok) return Response.json({ error: `QBO query failed: ${await qRes.text()}` }, { status: 500 })
          const qData = await qRes.json()
          const items = qData?.QueryResponse?.Item || []
                const results = []
                      for (const update of updates) {
                              const item = items.find(i => i.Name.toLowerCase() === update.name.toLowerCase())
                              if (!item) { results.push({ name: update.name, status: 'not_found' }); continue }
                              const uRes = await fetch(`${BASE_URL}/v3/company/${realmId}/item?minorversion=65`, {
                                        method: 'POST',
                                        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
                                        body: JSON.stringify({ sparse: true, Id: item.Id, SyncToken: item.SyncToken, PurchaseCost: update.newCost })
                              })
                              if (!uRes.ok) {
                                        results.push({ name: update.name, status: 'error', detail: await uRes.text() })
                              } else {
                                        results.push({ name: update.name, status: 'updated', oldCost: item.PurchaseCost, newCost: update.newCost })
                              }
                      }
          return Response.json({ ok: true, results })
    } catch (e) {
          return Response.json({ error: e.message }, { status: 500 })
    }
}
