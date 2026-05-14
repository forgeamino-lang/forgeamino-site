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
  { name: 'Founders Account',      AccountType: 'Bank',                    AccountSubType: 'CashOnHand' },
  { name: "Members' Equity",       AccountType: 'Equity',                  AccountSubType: 'OwnersEquity' },
  { name: 'Due to Owner — Sean',   AccountType: 'Other Current Liability', AccountSubType: 'OtherCurrentLiabilities' },
  { name: 'Compounded Goods Cost', AccountType: 'Other Current Asset',     AccountSubType: 'OtherCurrentAssets' },
  { name: 'Testing Costs',         AccountType: 'Other Current Asset',     AccountSubType: 'OtherCurrentAssets' },
  { name: 'Operating Account',     AccountType: 'Bank',                    AccountSubType: 'CashOnHand' },
  { name: 'Inventory Setup Adjustments', AccountType: 'Equity',            AccountSubType: 'OwnersEquity' },
]

// Testing-lab vendors + expenses (BT Labs + Freedom Diagnostics).
// Same pattern as PO_EXPENSES: posted Category Detail to Testing Costs (BS),
// paid from Due to Owner — Sean. P&L untouched — COGS for testing already
// baked into per-item PurchaseCost on the inventory items.
const TESTING_VENDORS = ['BT Labs', 'Freedom Diagnostics']
const TESTING_EXPENSES = [
  { ref: 'TEST-BTLABS', vendor: 'BT Labs',             amount: 4860.00,  memo: 'Testing costs to date — BT Labs. Paid personally; FA reimbursed from revenue. Capitalised to Testing Costs BS account; COGS already in per-item PurchaseCost.' },
  { ref: 'TEST-FREEDOM', vendor: 'Freedom Diagnostics', amount: 10350.00, memo: 'Testing costs to date — Freedom Diagnostics. Paid personally; FA reimbursed from revenue. Capitalised to Testing Costs BS account; COGS already in per-item PurchaseCost.' },
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

// Subsequent raw-goods POs entered later (post the initial 13-PO backfill).
// Same treatment: paid personally via Wise, FA reimbursed (Due to Owner — Sean),
// posted Category Detail to Inventory Asset.
const ADDITIONAL_POS = [
  { ref: 'PO #14', vendor: 'GGB',    amount: 5180.00, memo: 'PO #14 GGB — raw goods, paid personally; FA reimbursed' },
  { ref: 'PO #15', vendor: 'Andrew', amount: 4020.00, memo: 'PO #15 Andrew — raw goods, paid personally; FA reimbursed' },
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
async function createJournalEntry(realmId, token, { date, memo, lines }) {
  // lines = [{ amount, accountId, postingType: 'Debit'|'Credit', description? }]
  const body = {
    TxnDate: date,
    PrivateNote: memo,
    DocNumber: undefined,
    Line: lines.map(l => ({
      DetailType: 'JournalEntryLineDetail',
      Amount: l.amount,
      Description: l.description || memo,
      JournalEntryLineDetail: {
        PostingType: l.postingType,
        AccountRef: { value: l.accountId },
      },
    })),
  }
  const j = await qboFetch(realmId, token, '/journalentry', { method: 'POST', body: JSON.stringify(body) })
  return j?.JournalEntry
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
function buildOwnerLoanZeroPlan(amount) {
  return {
    journalEntry: {
      date: new Date().toISOString().slice(0, 10),
      memo: `Reimbursement of owner loan in full — FA revenue funded payback. Due to Owner — Sean balance cleared to zero.`,
      lines: [
        { account: 'Due to Owner — Sean', postingType: 'Debit',  amount },
        { account: 'Operating Account',   postingType: 'Credit', amount },
      ],
    },
    netEffect: {
      'Due to Owner — Sean': `-$${amount.toFixed(2)} (cleared)`,
      'Operating Account':   `-$${amount.toFixed(2)} (goes negative until revenue deposits booked)`,
    },
  }
}

function buildAdditionalPosPlan() {
  return {
    expenses: ADDITIONAL_POS,
    total: Number(ADDITIONAL_POS.reduce((s, e) => s + e.amount, 0).toFixed(2)),
    paymentAccount: 'Due to Owner — Sean (existing)',
    debitAccount: 'Inventory Asset (existing)',
  }
}

function buildTestingPlan() {
  return {
    accounts: [{ name: 'Testing Costs', type: 'Other Current Asset → OtherCurrentAssets', action: 'find-or-create on execute' }],
    vendors: TESTING_VENDORS.map(v => ({ name: v, action: 'find-or-create on execute' })),
    expenses: TESTING_EXPENSES,
    total: Number(TESTING_EXPENSES.reduce((s, e) => s + e.amount, 0).toFixed(2)),
    paymentAccount: 'Due to Owner — Sean (existing)',
    debitAccount: 'Testing Costs (BS asset)',
  }
}

function buildStaticPlan() {
  return {
    accounts: ACCOUNTS.map(a => ({
      name: a.name,
      type: `${a.AccountType} → ${a.AccountSubType}`,
      action: 'find-or-create on execute',
    })),
    inventoryAsset: { name: 'Inventory Asset (existing default)' },
    vendors: [...VENDORS, 'Andrew (existing)'].map(v => ({
      name: v,
      action: v.includes('existing') ? 'use existing' : 'find-or-create on execute',
    })),
    equityDeposit: EQUITY_DEPOSIT,
    poExpenses: PO_EXPENSES,
    poTotal: Number(PO_EXPENSES.reduce((s, p) => s + p.amount, 0).toFixed(2)),
  }
}

async function handle(request, { execute }) {
  const unauthorized = requireAdmin(request)
  if (unauthorized) return unauthorized

  const url = new URL(request.url)
  const accountsOnly               = url.searchParams.get('accountsOnly') === '1'
  const testingOnly                = url.searchParams.get('testingOnly')  === '1'
  const ownerLoanZero              = url.searchParams.get('ownerLoanZero') === '1'
  const additionalPosOnly          = url.searchParams.get('additionalPosOnly') === '1'
  const inventoryShrinkageCleanup  = url.searchParams.get('inventoryShrinkageCleanup') === '1'
  const ownerLoanAmount            = Number(url.searchParams.get('amount') || 66546.10)
  const shrinkageAmount            = Number(url.searchParams.get('amount') || 0)

  // Preview: return the static plan (no QBO calls — instant)
  if (!execute) {
    let plan
    if (ownerLoanZero) plan = buildOwnerLoanZeroPlan(ownerLoanAmount)
    else if (testingOnly) plan = buildTestingPlan()
    else if (additionalPosOnly) plan = buildAdditionalPosPlan()
    else if (inventoryShrinkageCleanup) {
      // Live query for the Shrinkage balance so preview shows the real number
      try {
        const realmId = process.env.QBO_REALM_ID
        const token = await getAccessToken()
        const shrinkage = await findAccountByName(realmId, token, 'Inventory Shrinkage')
        plan = {
          target_account: 'Inventory Shrinkage',
          found: !!shrinkage,
          current_balance: shrinkage?.CurrentBalance ?? null,
          account_subtype: shrinkage?.AccountSubType ?? null,
          new_account: 'Inventory Setup Adjustments (Equity → OwnersEquity)',
          journal_entry: {
            debit: 'Inventory Shrinkage  (zeros out the false expense)',
            credit: 'Inventory Setup Adjustments  (parks the true-up on the balance sheet)',
            amount: 'pass via ?amount=NN.NN on execute',
          },
        }
      } catch (e) {
        plan = { error: e.message }
      }
    }
    else plan = buildStaticPlan()
    return NextResponse.json({ ok: true, mode: 'preview', accountsOnly, testingOnly, ownerLoanZero, additionalPosOnly, inventoryShrinkageCleanup, plan })
  }

  const realmId = process.env.QBO_REALM_ID
  if (!realmId) return NextResponse.json({ ok: false, error: 'QBO_REALM_ID not set' }, { status: 500 })
  const token = await getAccessToken()

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
  if (accountsOnly) {
    return NextResponse.json({
      ok: true,
      mode: 'execute',
      accountsOnly: true,
      summary: { accounts: Object.keys(accountIds).length, vendors: 0, equity_deposit_id: null, purchases_created: 0, purchases_failed: 0 },
      log,
    })
  }

  // ── Testing-only flow ──────────────────────────────────────────────────
  if (testingOnly) {
    // Ensure required vendors exist
    const testingVendorIds = {}
    for (const v of TESTING_VENDORS) {
      const existing = await findVendorByName(realmId, token, v)
      if (existing) {
        testingVendorIds[v] = existing.Id
        log.push({ step: 'vendor', name: v, action: 'reused', id: existing.Id })
      } else {
        const created = await createVendor(realmId, token, v)
        testingVendorIds[v] = created.Id
        log.push({ step: 'vendor', name: v, action: 'created', id: created.Id })
      }
    }
    // Resolve Testing Costs + Due to Owner account ids
    const testingCostsAcct = await findAccountByName(realmId, token, 'Testing Costs')
    const dueToOwnerAcct   = await findAccountByName(realmId, token, 'Due to Owner — Sean')
    if (!testingCostsAcct) {
      return NextResponse.json({ ok: false, error: 'Testing Costs account not found — run with ?accountsOnly=1 first', log }, { status: 500 })
    }
    if (!dueToOwnerAcct) {
      return NextResponse.json({ ok: false, error: 'Due to Owner — Sean account not found — run with ?accountsOnly=1 first', log }, { status: 500 })
    }

    const today = new Date().toISOString().slice(0, 10)
    const purchaseLog = []
    for (const exp of TESTING_EXPENSES) {
      const vId = testingVendorIds[exp.vendor]
      if (!vId) {
        purchaseLog.push({ ref: exp.ref, status: 'skipped (vendor missing)', vendor: exp.vendor })
        continue
      }
      try {
        const pur = await createExpensePurchase(realmId, token, {
          date: today,
          amount: exp.amount,
          paymentAccountId: dueToOwnerAcct.Id,
          vendorId: vId,
          accountId: testingCostsAcct.Id,
          memo: exp.memo,
          refNo: exp.ref,
        })
        purchaseLog.push({ ref: exp.ref, status: 'created', id: pur?.Id, amount: exp.amount, vendor: exp.vendor })
      } catch (e) {
        purchaseLog.push({ ref: exp.ref, status: 'error', error: e?.message || String(e), vendor: exp.vendor })
      }
    }
    log.push({ step: 'testing-purchases', count: purchaseLog.filter(p => p.status === 'created').length, results: purchaseLog })

    return NextResponse.json({
      ok: true,
      mode: 'execute',
      testingOnly: true,
      summary: {
        accounts: Object.keys(accountIds).length,
        vendors: Object.keys(testingVendorIds).length,
        equity_deposit_id: null,
        purchases_created: purchaseLog.filter(p => p.status === 'created').length,
        purchases_failed: purchaseLog.filter(p => p.status === 'error').length,
      },
      log,
    })
  }

  // ── Zero-out Due to Owner — Sean (single journal entry) ────────────────
  if (ownerLoanZero) {
    const dueToOwner    = await findAccountByName(realmId, token, 'Due to Owner — Sean')
    const operatingAcct = await findAccountByName(realmId, token, 'Operating Account')
    if (!dueToOwner)    return NextResponse.json({ ok: false, error: "Due to Owner — Sean account missing — run ?accountsOnly=1 first", log }, { status: 500 })
    if (!operatingAcct) return NextResponse.json({ ok: false, error: "Operating Account missing — run ?accountsOnly=1 first", log }, { status: 500 })

    const amount = ownerLoanAmount
    try {
      const je = await createJournalEntry(realmId, token, {
        date: new Date().toISOString().slice(0, 10),
        memo: `Reimbursement of owner loan in full — FA revenue funded payback. Due to Owner — Sean balance cleared to zero.`,
        lines: [
          { amount, accountId: dueToOwner.Id,    postingType: 'Debit',  description: 'Owner loan reimbursed in full' },
          { amount, accountId: operatingAcct.Id, postingType: 'Credit', description: 'Paid from FA operating funds' },
        ],
      })
      log.push({ step: 'journal-entry', purpose: 'zero owner loan', amount, id: je?.Id })
      return NextResponse.json({
        ok: true, mode: 'execute', ownerLoanZero: true,
        summary: { accounts: Object.keys(accountIds).length, journalEntryId: je?.Id, amountCleared: amount },
        log,
      })
    } catch (e) {
      return NextResponse.json({ ok: false, error: e?.message || String(e), log }, { status: 500 })
    }
  }

  // ── Additional raw-goods POs (PO #14, #15, etc.) ───────────────────────
  if (additionalPosOnly) {
    const inventoryAsset = await findAccountByName(realmId, token, 'Inventory Asset')
    const dueToOwner     = await findAccountByName(realmId, token, 'Due to Owner — Sean')
    if (!inventoryAsset) return NextResponse.json({ ok: false, error: 'Inventory Asset account not found', log }, { status: 500 })
    if (!dueToOwner)     return NextResponse.json({ ok: false, error: 'Due to Owner — Sean account not found — run ?accountsOnly=1 first', log }, { status: 500 })

    // Ensure each vendor exists (uses existing find-or-create)
    const newPoVendorIds = {}
    for (const po of ADDITIONAL_POS) {
      if (newPoVendorIds[po.vendor]) continue
      const existing = await findVendorByName(realmId, token, po.vendor)
      if (existing) {
        newPoVendorIds[po.vendor] = existing.Id
        log.push({ step: 'vendor', name: po.vendor, action: 'reused', id: existing.Id })
      } else {
        const created = await createVendor(realmId, token, po.vendor)
        newPoVendorIds[po.vendor] = created.Id
        log.push({ step: 'vendor', name: po.vendor, action: 'created', id: created.Id })
      }
    }

    const today = new Date().toISOString().slice(0, 10)
    const purchaseLog = []
    for (const po of ADDITIONAL_POS) {
      const vId = newPoVendorIds[po.vendor]
      try {
        const pur = await createExpensePurchase(realmId, token, {
          date: today,
          amount: po.amount,
          paymentAccountId: dueToOwner.Id,
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
    log.push({ step: 'additional-pos', count: purchaseLog.filter(p => p.status === 'created').length, results: purchaseLog })

    return NextResponse.json({
      ok: true,
      mode: 'execute',
      additionalPosOnly: true,
      summary: {
        purchases_created: purchaseLog.filter(p => p.status === 'created').length,
        purchases_failed: purchaseLog.filter(p => p.status === 'error').length,
        total_posted: purchaseLog.filter(p => p.status === 'created').reduce((s, p) => s + p.amount, 0),
      },
      log,
    })
  }

  // ── Inventory Shrinkage reclassification (single JE) ───────────────────
  if (inventoryShrinkageCleanup) {
    if (!shrinkageAmount || shrinkageAmount <= 0) {
      return NextResponse.json({ ok: false, error: 'Provide ?amount=NN.NN with the Inventory Shrinkage balance to reclassify.', log }, { status: 400 })
    }
    const shrinkageAcct = await findAccountByName(realmId, token, 'Inventory Shrinkage')
    const setupAdjAcct  = await findAccountByName(realmId, token, 'Inventory Setup Adjustments')
    if (!shrinkageAcct)  return NextResponse.json({ ok: false, error: 'Inventory Shrinkage account not found in QBO.', log }, { status: 404 })
    if (!setupAdjAcct)   return NextResponse.json({ ok: false, error: 'Inventory Setup Adjustments account missing — run ?accountsOnly=1 first.', log }, { status: 500 })

    try {
      const je = await createJournalEntry(realmId, token, {
        date: new Date().toISOString().slice(0, 10),
        memo: `Reclassify Inventory Shrinkage expense ($${shrinkageAmount.toFixed(2)}) to Inventory Setup Adjustments — historical entries were inventory-setup true-ups, not actual shrinkage.`,
        lines: [
          // Debit shrinkage to zero out the expense
          { amount: shrinkageAmount, accountId: shrinkageAcct.Id, postingType: 'Debit',  description: 'Zero out non-shrinkage adjustments wrongly booked here' },
          // Credit the equity true-up account
          { amount: shrinkageAmount, accountId: setupAdjAcct.Id,  postingType: 'Credit', description: 'Historical inventory true-up reclassification' },
        ],
      })
      log.push({ step: 'journal-entry', purpose: 'reclassify shrinkage', amount: shrinkageAmount, id: je?.Id })
      return NextResponse.json({
        ok: true,
        mode: 'execute',
        inventoryShrinkageCleanup: true,
        summary: { journalEntryId: je?.Id, amountReclassified: shrinkageAmount },
        log,
      })
    } catch (e) {
      return NextResponse.json({ ok: false, error: e.message, log }, { status: 500 })
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
