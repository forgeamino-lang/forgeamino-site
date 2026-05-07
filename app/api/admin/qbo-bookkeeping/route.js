import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../../lib/adminAuth'
import { getAccessToken } from '../../../../lib/quickbooks'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0
export const runtime = 'nodejs'
export const maxDuration = 300

const QBO_ENVIRONMENT = process.env.QBO_ENVIRONMENT || 'sandbox'
const BASE_URL =
  QBO_ENVIRONMENT === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com'

// ── Plan: what we're going to create ───────────────────────────────────────
// Accounts to ensure exist:
const ACCOUNTS = [
  { name: 'Founders Account',     AccountType: 'Bank',                    AccountSubType: 'CashOnHand' },
  { name: "Members' Equity",      AccountType: 'Equity',                  AccountSubType: 'OwnersEquity' },
  { name: 'Due to Owner — Sean',  AccountType: 'Other Current Liability', AccountSubType: 'OtherCurrentLiabilities' },
]

// Vendors to ensure exist (Andrew already exists in QBO)
const VENDORS = ['GGB', 'Hanyou', 'LP Peptides', 'Dangkang']

// Equity contribution
const EQUITY_DEPOSIT = {
  date: '2026-02-01',
  amount: 16949.00,
  toAccount: 'Founders Account',
  fromAccount: "Members' Equity",
  memo: 'Initial cash equity contribution from 4 members ($4,237.25 each) — recorded as consolidated Members\' Equity per Sean',
}

// 13 PO Expenses (line-sum totals, Proviron + Test Cyp excluded per Sean)
const PO_EXPENSES = [
  { ref: 'PO #1',  vendor: 'Andrew',      amount: 2438.00,  memo: 'PO #1 (file: PO #000001.xlsx, internal label "PO #3 Andrew") — raw goods, paid personally via Wise; FA reimbursed' },
  { ref: 'PO #2',  vendor: 'Hanyou',      amount: 1760.00,  memo: 'PO #2 Hanyou — raw goods, paid personally via Wise; FA reimbursed' },
  { ref: 'PO #3',  vendor: 'Andrew',      amount: 3425.00,  memo: 'PO #3 Andrew — raw goods, paid personally via Wise; FA reimbursed' },
  { ref: 'PO #4',  vendor: 'GGB',         amount: 1789.00,  memo: 'PO #4 GGB — raw goods, paid personally via Wise; FA reimbursed' },
  { ref: 'PO #5',  vendor: 'Andrew',      amount: 6460.00,  memo: 'PO #5 Andrew — raw goods, paid personally via Wise; FA reimbursed' },
  { ref: 'PO #6',  vendor: 'GGB',         amount: 2400.00,  memo: 'PO #6 GGB US (same vendor as GGB) — raw goods, paid personally via Wise; FA reimbursed' },
  { ref: 'PO #7',  vendor: 'Hanyou',      amount: 3550.00,  memo: 'PO #7 Hanyou — raw goods, paid personally via Wise; FA reimbursed' },
  { ref: 'PO #8',  vendor: 'Andrew',      amount: 8670.00,  memo: 'PO #8 Andrew — raw goods, paid personally via Wise; FA reimbursed' },
  { ref: 'PO #9',  vendor: 'GGB',         amount: 3550.00,  memo: 'PO #9 GGB — raw goods (Proviron $100 excluded as personal); paid personally via Wise; FA reimbursed' },
  { ref: 'PO #10', vendor: 'Andrew',      amount: 13125.00, memo: 'PO #10 Andrew — raw goods, paid personally via Wise; FA reimbursed' },
  { ref: 'PO #11', vendor: 'GGB',         amount: 2100.00,  memo: 'PO #11 GGB — raw goods (Test Cyp $75 excluded as personal); paid personally via Wise; FA reimbursed' },
  { ref: 'PO #12', vendor: 'LP Peptides', amount: 1069.10,  memo: 'PO #12 LP Peptides — raw goods, paid personally via Wise; FA reimbursed' },
  { ref: 'PO #13', vendor: 'Dangkang',    amount: 1000.00,  memo: 'PO #13 Dangkang — raw goods, paid personally via Wise; FA reimbursed' },
]

// ── QBO REST helpers ──────────────────────────────────────────────────────
async function qboFetch(realmId, token, path, opts = {}) {
  const url = `${BASE_URL}/v3/company/${realmId}${path}${path.includes('?') ? '&' : '?'}minorversion=65`
  const resp = await fetch(url, {
    ...opts,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.headers || {}),
    },
  })
  const text = await resp.text()
  if (!resp.ok) {
    throw new Error(`QBO ${opts.method || 'GET'} ${path} failed: ${resp.status} ${text.slice(0, 600)}`)
  }
  try { return JSON.parse(text) } catch { return text }
}

async function findAccountByName(realmId, token, name) {
  const escaped = name.replace(/'/g, "\\'")
  const q = `SELECT Id, Name, AccountType, AccountSubType, Active FROM Account WHERE Name = '${escaped}'`
  const j = await qboFetch(realmId, token, `/query?query=${encodeURIComponent(q)}`)
  return j?.QueryResponse?.Account?.[0] || null
}
async function createAccount(realmId, token, { name, AccountType, AccountSubType }) {
  const j = await qboFetch(realmId, token, '/account', {
    method: 'POST',
    body: JSON.stringify({ Name: name, AccountType, AccountSubType }),
  })
  return j?.Account
}
async function findVendorByName(realmId, token, name) {
  const escaped = name.replace(/'/g, "\\'")
  const q = `SELECT Id, DisplayName, Active FROM Vendor WHERE DisplayName = '${escaped}'`
  const j = await qboFetch(realmId, token, `/query?query=${encodeURIComponent(q)}`)
  return j?.QueryResponse?.Vendor?.[0] || null
}
async function createVendor(realmId, token, name) {
  const j = await qboFetch(realmId, token, '/vendor', {
    method: 'POST',
    body: JSON.stringify({ DisplayName: name }),
  })
  return j?.Vendor
}
async function createDeposit(realmId, token, { date, amount, toAccountId, fromAccountId, memo }) {
  const body = {
    TxnDate: date,
    DepositToAccountRef: { value: toAccountId },
    PrivateNote: memo,
    Line: [{
      Amount: amount,
      DetailType: 'DepositLineDetail',
      Description: memo,
      DepositLineDetail: { AccountRef: { value: fromAccountId } },
    }],
  }
  const j = await qboFetch(realmId, token, '/deposit', { method: 'POST', body: JSON.stringify(body) })
  return j?.Deposit
}
async function createExpensePurchase(realmId, token, { date, amount, paymentAccountId, vendorId, accountId, memo, refNo }) {
  const body = {
    PaymentType: 'Cash',
    AccountRef:  { value: paymentAccountId },
    EntityRef:   { value: vendorId, type: 'Vendor' },
    TxnDate:     date,
    DocNumber:   refNo,
    PrivateNote: memo,
    Line: [{
      Amount:      amount,
      DetailType: 'AccountBasedExpenseLineDetail',
      Description: memo,
      AccountBasedExpenseLineDetail: { AccountRef: { value: accountId } },
    }],
  }
  const j = await qboFetch(realmId, token, '/purchase', { method: 'POST', body: JSON.stringify(body) })
  return j?.Purchase
}

// ── Main handler ──────────────────────────────────────────────────────────
// GET  /api/admin/qbo-bookkeeping?key=...           → preview (no writes)
// POST /api/admin/qbo-bookkeeping?key=...&go=1       → execute
async function buildPlan(realmId, token) {
  // Look up existing accounts/vendors to determine what already exists vs needs creating
  const accountStatus = {}
  for (const a of ACCOUNTS) {
    const existing = await findAccountByName(realmId, token, a.name)
    accountStatus[a.name] = existing ? { exists: true, id: existing.Id } : { exists: false }
  }
  const vendorStatus = {}
  for (const v of [...VENDORS, 'Andrew']) {
    const existing = await findVendorByName(realmId, token, v)
    vendorStatus[v] = existing ? { exists: true, id: existing.Id } : { exists: false }
  }

  // Inventory Asset (auto-existing default account in QBO)
  const inventoryAsset = await findAccountByName(realmId, token, 'Inventory Asset')

  return {
    accounts: ACCOUNTS.map(a => ({
      name: a.name,
      type: `${a.AccountType} → ${a.AccountSubType}`,
      action: accountStatus[a.name].exists ? 'use existing' : 'CREATE',
      id: accountStatus[a.name].id || null,
    })),
    inventoryAsset: inventoryAsset ? { id: inventoryAsset.Id, name: inventoryAsset.Name } : null,
    vendors: [...VENDORS, 'Andrew'].map(v => ({
      name: v,
      action: vendorStatus[v].exists ? 'use existing' : 'CREATE',
      id: vendorStatus[v].id || null,
    })),
    equityDeposit: EQUITY_DEPOSIT,
    poExpenses: PO_EXPENSES,
    poTotal: PO_EXPENSES.reduce((s, p) => s + p.amount, 0),
  }
}

async function handle(request, { execute }) {
  const unauthorized = requireAdmin(request)
  if (unauthorized) return unauthorized

  const realmId = process.env.QBO_REALM_ID
  if (!realmId) return NextResponse.json({ ok: false, error: 'QBO_REALM_ID not set' }, { status: 500 })
  const token = await getAccessToken()

  const plan = await buildPlan(realmId, token)
  if (!execute) {
    return NextResponse.json({ ok: true, mode: 'preview', plan })
  }

  // EXECUTE
  const log = []
  const accountIds = {}
  for (const a of ACCOUNTS) {
    const existing = await findAccountByName(realmId, token, a.name)
    if (existing) {
      accountIds[a.name] = existing.Id
      log.push({ step: 'account', name: a.name, action: 'reused', id: existing.Id })
    } else {
      const created = await createAccount(realmId, token, a)
      accountIds[a.name] = created.Id
      log.push({ step: 'account', name: a.name, action: 'created', id: created.Id })
    }
  }
  const inventoryAsset = await findAccountByName(realmId, token, 'Inventory Asset')
  if (!inventoryAsset) {
    return NextResponse.json({ ok: false, error: 'Inventory Asset account not found in QBO', log }, { status: 500 })
  }

  const vendorIds = {}
  for (const v of [...VENDORS, 'Andrew']) {
    const existing = await findVendorByName(realmId, token, v)
    if (existing) {
      vendorIds[v] = existing.Id
      log.push({ step: 'vendor', name: v, action: 'reused', id: existing.Id })
    } else {
      const created = await createVendor(realmId, token, v)
      vendorIds[v] = created.Id
      log.push({ step: 'vendor', name: v, action: 'created', id: created.Id })
    }
  }

  // Equity deposit
  const dep = await createDeposit(realmId, token, {
    date: EQUITY_DEPOSIT.date,
    amount: EQUITY_DEPOSIT.amount,
    toAccountId: accountIds['Founders Account'],
    fromAccountId: accountIds["Members' Equity"],
    memo: EQUITY_DEPOSIT.memo,
  })
  log.push({ step: 'deposit', date: EQUITY_DEPOSIT.date, amount: EQUITY_DEPOSIT.amount, id: dep?.Id })

  // 13 PO expenses
  // Date: today
  const today = new Date().toISOString().slice(0, 10)
  const purchaseLog = []
  for (const po of PO_EXPENSES) {
    const vId = vendorIds[po.vendor]
    if (!vId) {
      purchaseLog.push({ ref: po.ref, status: 'skipped (vendor missing)', vendor: po.vendor })
      continue
    }
    try {
      const pur = await createExpensePurchase(realmId, token, {
        date: today,
        amount: po.amount,
        paymentAccountId: accountIds['Due to Owner — Sean'],
        vendorId: vId,
        accountId: inventoryAsset.Id,
        memo: po.memo,
        refNo: po.ref,
      })
      purchaseLog.push({ ref: po.ref, status: 'created', id: pur?.Id, amount: po.amount, vendor: po.vendor })
    } catch (e) {
      purchaseLog.push({ ref: po.ref, status: 'error', error: e?.message || String(e), vendor: po.vendor })
    }
  }
  log.push({ step: 'purchases', count: purchaseLog.filter(p => p.status === 'created').length, results: purchaseLog })

  return NextResponse.json({
    ok: true,
    mode: 'execute',
    summary: {
      accounts: Object.keys(accountIds).length,
      vendors: Object.keys(vendorIds).length,
      equity_deposit_id: dep?.Id || null,
      purchases_created: purchaseLog.filter(p => p.status === 'created').length,
      purchases_failed: purchaseLog.filter(p => p.status === 'error').length,
    },
    log,
  })
}

export async function GET(request) {
  return handle(request, { execute: false })
}
export async function POST(request) {
  const url = new URL(request.url)
  const go = url.searchParams.get('go') === '1'
  if (!go) {
    return NextResponse.json({ ok: false, error: 'Missing ?go=1 to actually execute. Use GET for preview.' }, { status: 400 })
  }
  return handle(request, { execute: true })
}
