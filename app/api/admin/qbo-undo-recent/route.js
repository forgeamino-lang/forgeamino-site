import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../../lib/adminAuth'
import { getAccessToken } from '../../../../lib/quickbooks'

// Inspect (GET) or delete (POST?confirm=1) recently-created QBO transactions
// matching a specific id range or created-after timestamp. Built to reverse
// the accidental duplicate run of /api/admin/qbo-bookkeeping (commit 9313750
// was not yet deployed when the call fired — it ran the default backfill).
//
// Query params:
//   purchaseIds=601,605,... or purchaseIdRange=640-652
//   depositIds=639
//   confirm=1 (POST only — actually performs delete)
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0
export const runtime = 'nodejs'
export const maxDuration = 60

const QBO_ENVIRONMENT = process.env.QBO_ENVIRONMENT || 'sandbox'
const BASE_URL =
  QBO_ENVIRONMENT === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com'

async function qboFetch(realmId, token, path, opts = {}) {
  const url = `${BASE_URL}/v3/company/${realmId}${path}${path.includes('?') ? '&' : '?'}minorversion=65`
  const r = await fetch(url, {
    ...opts,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.headers || {}),
    },
  })
  const t = await r.text()
  if (!r.ok) throw new Error(`QBO ${opts.method || 'GET'} ${path} ${r.status}: ${t.slice(0, 400)}`)
  return t ? JSON.parse(t) : null
}

function parseIdRange(s) {
  if (!s) return []
  if (s.includes('-')) {
    const [a, b] = s.split('-').map(Number)
    const out = []
    for (let i = a; i <= b; i++) out.push(String(i))
    return out
  }
  return s.split(',').map(x => x.trim()).filter(Boolean)
}

async function inspectEntity(realmId, token, entity, id) {
  try {
    const j = await qboFetch(realmId, token, `/${entity.toLowerCase()}/${id}`)
    return j?.[entity] || j?.Entity || null
  } catch (e) {
    return { _error: e.message }
  }
}

async function deleteEntity(realmId, token, entity, obj) {
  const payload = { Id: obj.Id, SyncToken: obj.SyncToken }
  const j = await qboFetch(realmId, token, `/${entity.toLowerCase()}?operation=delete`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return j
}

async function handle(request, { execute }) {
  const unauthorized = requireAdmin(request)
  if (unauthorized) return unauthorized
  const realmId = process.env.QBO_REALM_ID
  if (!realmId) return NextResponse.json({ ok: false, error: 'QBO_REALM_ID not set' }, { status: 500 })
  const token = await getAccessToken()

  const url = new URL(request.url)
  const purchaseIds = parseIdRange(url.searchParams.get('purchaseIds') || url.searchParams.get('purchaseIdRange') || '')
  const depositIds  = parseIdRange(url.searchParams.get('depositIds') || '')

  if (!purchaseIds.length && !depositIds.length) {
    return NextResponse.json({ ok: false, error: 'Provide purchaseIds, purchaseIdRange, or depositIds.' }, { status: 400 })
  }

  // Inspect first
  const inspect = { purchases: [], deposits: [] }
  for (const id of purchaseIds) inspect.purchases.push({ id, data: await inspectEntity(realmId, token, 'Purchase', id) })
  for (const id of depositIds)  inspect.deposits.push({ id,  data: await inspectEntity(realmId, token, 'Deposit',  id) })

  if (!execute) {
    // Just preview what we'd delete
    return NextResponse.json({
      ok: true,
      mode: 'preview',
      will_delete: {
        purchases: inspect.purchases.map(p => ({
          id: p.id,
          doc_number: p.data?.DocNumber || null,
          total: p.data?.TotalAmt || null,
          vendor: p.data?.EntityRef?.name || null,
          create_time: p.data?.MetaData?.CreateTime || null,
          private_note: p.data?.PrivateNote || null,
        })),
        deposits: inspect.deposits.map(d => ({
          id: d.id,
          total: d.data?.TotalAmt || null,
          create_time: d.data?.MetaData?.CreateTime || null,
          private_note: d.data?.PrivateNote || null,
        })),
      },
    })
  }

  // Execute deletions
  const log = []
  for (const p of inspect.purchases) {
    if (!p.data || p.data._error) { log.push({ entity: 'Purchase', id: p.id, status: 'not-found-or-err' }); continue }
    try {
      await deleteEntity(realmId, token, 'Purchase', p.data)
      log.push({ entity: 'Purchase', id: p.id, doc: p.data.DocNumber, status: 'deleted' })
    } catch (e) {
      log.push({ entity: 'Purchase', id: p.id, status: 'error', error: e.message })
    }
  }
  for (const d of inspect.deposits) {
    if (!d.data || d.data._error) { log.push({ entity: 'Deposit', id: d.id, status: 'not-found-or-err' }); continue }
    try {
      await deleteEntity(realmId, token, 'Deposit', d.data)
      log.push({ entity: 'Deposit', id: d.id, status: 'deleted' })
    } catch (e) {
      log.push({ entity: 'Deposit', id: d.id, status: 'error', error: e.message })
    }
  }
  return NextResponse.json({ ok: true, mode: 'execute', log })
}

export async function GET(request)  { return handle(request, { execute: false }) }
export async function POST(request) {
  const url = new URL(request.url)
  if (url.searchParams.get('confirm') !== '1') {
    return NextResponse.json({ ok: false, error: 'Missing ?confirm=1' }, { status: 400 })
  }
  return handle(request, { execute: true })
}
