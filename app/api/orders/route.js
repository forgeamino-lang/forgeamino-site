import { NextResponse } from 'next/server'
import { createServerClient, generateOrderNumber } from '../../../lib/supabase'
import { sendOrderConfirmationEmail, sendOrderReceivedAlert } from '../../../lib/email'
import { syncToQuickBooks } from '../../../lib/quickbooks'
import { broadcastOrderNotification } from '../../../lib/pushNotify'
import { requireAdmin } from '../../../lib/adminAuth'
import * as Sentry from '@sentry/nextjs'
import { validateLineItems, computeOrderTotals } from '../../../lib/orderValidation'
import { verifyLabCookie } from '../../../lib/labAuth'

export async function POST(request) {
try {
const body = await request.json()
const {
customer_name,
customer_email,
customer_phone,
shipping_address,
payment_method,
shipping_method,
line_items,
subtotal,
tax_amount,
tax_rate,
total,
affiliate_code,
} = body

// Basic validation
if (!customer_name || !customer_email || !shipping_address || !line_items?.length) {
return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
}

// ── Server-side line-item validation ────────────────────────────────────
// All validation logic lives in lib/orderValidation.js (pure + unit-tested).
// In short: slug must match a known product; hidden products need lab
// access; prices + qbo_name are substituted from the catalog.
const hasLabAccess = verifyLabCookie()
const v = validateLineItems(line_items, { hasLabAccess })
if (!v.ok) {
return NextResponse.json({ error: v.error }, { status: v.status })
}
const validated_line_items = v.validated

// Server-trusted totals — subtotal from catalog prices, tax_rate from client.
const {
subtotal: server_subtotal,
tax_rate: trusted_tax_rate,
tax_amount: server_tax_amount,
shipping_method: trusted_shipping_method,
shipping_amount: server_shipping_amount,
total: server_total,
} = computeOrderTotals(validated_line_items, tax_rate, shipping_method)

// Warn loudly if client-computed totals diverged by more than 1¢.
const client_total = Number(total)
if (Number.isFinite(client_total) && Math.abs(client_total - server_total) > 0.01) {
console.warn('Order total mismatch (using server values):', {
client_total, server_total,
client_subtotal: subtotal, server_subtotal,
client_tax: tax_amount, server_tax: server_tax_amount,
})
}

const supabase = createServerClient()
const order_number = generateOrderNumber()

// Embed tax data in shipping_address JSONB to avoid schema changes
const shipping_address_with_tax = {
...shipping_address,
subtotal: server_subtotal,
tax_amount: server_tax_amount,
tax_rate: trusted_tax_rate,
shipping_method: trusted_shipping_method,
shipping_amount: server_shipping_amount,
}

// ── Resolve affiliate code with sticky first-touch attribution ─────────
// Once a customer's email is mapped to an affiliate code in
// customer_affiliate_attribution, every future order picks up that locked
// code regardless of what the form has. New attributions get written when
// a customer's first ordered code resolves to an active affiliate.
// Silent override — customer never sees a difference.
let affiliate_code_clean = null
let affiliate_id = null
let attribution_source = 'none' // 'locked' | 'form' | 'none'
let should_write_attribution = false
const email_lower = typeof customer_email === 'string'
? customer_email.trim().toLowerCase()
: ''

// Step 1 — does this email already have a locked attribution?
if (email_lower) {
try {
const { data: lock } = await supabase
.from('customer_affiliate_attribution')
.select('affiliate_code, affiliate_id')
.eq('customer_email', email_lower)
.maybeSingle()
if (lock?.affiliate_code) {
affiliate_code_clean = lock.affiliate_code
affiliate_id = lock.affiliate_id || null
attribution_source = 'locked'
}
} catch (lookupErr) {
console.error('Sticky attribution lookup failed:', lookupErr)
}
}

// Step 2 — if not locked, fall back to the form-typed code (and resolve it).
// Also pull discount_pct so we can apply customer-facing discounts
// (e.g., FRIENDS = 10% off) when the code is ACTIVELY typed at checkout.
let form_discount_pct = 0
let form_discount_to_cost = false
let form_discount_to_fixed_price = false
let form_product_prices = null
let form_email_whitelist = null
if (attribution_source === 'none' && typeof affiliate_code === 'string') {
const trimmed = affiliate_code.trim()
if (trimmed.length > 0) {
affiliate_code_clean = trimmed
try {
const { data: aff } = await supabase
.from('affiliates')
.select('id, code, discount_pct, discount_to_cost, discount_to_fixed_price, product_prices, email_whitelist')
.ilike('code', trimmed)
.eq('active', true)
.maybeSingle()
if (aff) {
affiliate_id = aff.id
affiliate_code_clean = aff.code
attribution_source = 'form'
should_write_attribution = !!email_lower
form_discount_pct = Number(aff.discount_pct || 0)
form_discount_to_cost = !!aff.discount_to_cost
form_discount_to_fixed_price = !!aff.discount_to_fixed_price
form_product_prices = aff.product_prices || null
form_email_whitelist = Array.isArray(aff.email_whitelist) ? aff.email_whitelist.map(s => String(s).toLowerCase()) : null
}
} catch (lookupErr) {
console.error('Affiliate lookup failed:', lookupErr)
}
}
}

// ── If sticky-locked, populate discount fields from affiliates table ───
// Step 1 only fetched code+id from the attribution table; we need
// discount_pct, discount_to_cost, and email_whitelist to decide whether
// to apply when the customer actively re-types the same code.
if (attribution_source === 'locked' && affiliate_id) {
try {
const { data: aff } = await supabase
.from('affiliates')
.select('discount_pct, discount_to_cost, discount_to_fixed_price, product_prices, email_whitelist')
.eq('id', affiliate_id)
.maybeSingle()
if (aff) {
form_discount_pct = Number(aff.discount_pct || 0)
form_discount_to_cost = !!aff.discount_to_cost
form_discount_to_fixed_price = !!aff.discount_to_fixed_price
form_product_prices = aff.product_prices || null
form_email_whitelist = Array.isArray(aff.email_whitelist)
? aff.email_whitelist.map(v => String(v).toLowerCase())
: null
}
} catch (e) {
console.error('Sticky-locked affiliate discount lookup failed:', e?.message || e)
}
}

// Did the customer ACTIVELY type a code on THIS order that matches the
// resolved attribution code?
const form_typed_raw = typeof affiliate_code === 'string' ? affiliate_code.trim() : ''
const form_code_typed_matches = form_typed_raw.length > 0 && affiliate_code_clean &&
form_typed_raw.toLowerCase() === affiliate_code_clean.toLowerCase()

// ── If locked to a DIFFERENT code than typed, fetch that code's discount ─
// Attribution stays with the locked code for analytics. But the customer
// should receive the discount for whatever valid code they actively typed —
// even if their email is sticky-locked to a different affiliate. This handles
// e.g. an OWNERS-locked customer who types FRIENDS at checkout: they receive
// the FRIENDS 10% discount while the order is still attributed to OWNERS.
if (attribution_source === 'locked' && !form_code_typed_matches && form_typed_raw.length > 0) {
try {
const { data: typed_aff } = await supabase
.from('affiliates')
.select('discount_pct, discount_to_cost, discount_to_fixed_price, product_prices, email_whitelist')
.ilike('code', form_typed_raw)
.eq('active', true)
.maybeSingle()
if (typed_aff) {
// Overwrite form_discount_* with the typed code's config so the
// discount calculation below uses the right values.
form_discount_pct = Number(typed_aff.discount_pct || 0)
form_discount_to_cost = !!typed_aff.discount_to_cost
form_discount_to_fixed_price = !!typed_aff.discount_to_fixed_price
form_product_prices = typed_aff.product_prices || null
form_email_whitelist = Array.isArray(typed_aff.email_whitelist)
? typed_aff.email_whitelist.map(s => String(s).toLowerCase())
: null
}
} catch (e) {
console.error('Typed code discount fallback lookup failed:', e?.message || e)
}
}

// ── Apply customer-facing discount (if any) ────────────────────────────
// Applies whenever the customer actively typed any affiliate code, regardless
// of sticky attribution. Attribution (which code gets credit) is separate from
// discount eligibility (whether a typed code grants a price break).
// Per-order rule: discount is NOT sticky across orders — code must be typed.
//
// If the affiliate has an email_whitelist, the customer email must be in
// it (case-insensitive). Otherwise the discount is silently rejected and
// the order proceeds at retail. This protects cost-pricing leakage.
let server_discount_amount = 0
let server_subtotal_before_discount = server_subtotal
let final_subtotal = server_subtotal
let final_tax_amount = server_tax_amount
let final_total = server_total

if (form_typed_raw.length > 0) {
const whitelist_ok = !form_email_whitelist || (email_lower && form_email_whitelist.includes(email_lower))

// Cost-based discount (OWNERS): pay QBO PurchaseCost instead of retail.
// Sum per-line (qty * (price - cost)), clamped to >= 0. Items without
// a positive cost contribute 0 (no discount on that line).
if (whitelist_ok && form_discount_to_cost) {
try {
const { getAccessToken, fetchQboItems } = await import('../../../lib/quickbooks')
const realmId = process.env.QBO_REALM_ID
if (realmId) {
const token = await getAccessToken()
const itemsByName = await fetchQboItems(token, realmId)
let total_disc = 0
for (const li of validated_line_items) {
const name = li.qbo_name || li.name
const qboItem = itemsByName.get(name)
const cost = Number(qboItem?.PurchaseCost || 0)
const price = Number(li.price || 0)
const qty = Number(li.quantity || 0)
if (cost > 0) {
total_disc += Math.max(0, qty * (price - cost))
}
}
server_discount_amount = Number(total_disc.toFixed(2))
}
} catch (e) {
console.error('OWNERS cost-discount calculation failed:', e?.message || e)
// Silent fallback: no discount applied, order proceeds at retail
server_discount_amount = 0
}
}

// Percent-based discount (FRIENDS): straight percentage off subtotal.
else if (whitelist_ok && form_discount_pct > 0) {
server_discount_amount = Number((server_subtotal * form_discount_pct).toFixed(2))
}

// Fixed-price discount (FAMILY): per-product fixed price, discount = retail - fixed.
else if (whitelist_ok && form_discount_to_fixed_price && form_product_prices) {
let total_disc = 0
for (const li of validated_line_items) {
const name = li.qbo_name || li.name
const fixed = Number(form_product_prices[name])
const retail = Number(li.price || 0)
const qty = Number(li.quantity || 0)
if (Number.isFinite(fixed) && fixed >= 0 && fixed < retail) {
total_disc += qty * (retail - fixed)
}
}
server_discount_amount = Number(total_disc.toFixed(2))
}

if (server_discount_amount > 0) {
final_subtotal = Number((server_subtotal - server_discount_amount).toFixed(2))
// Recompute tax on the discounted subtotal (standard sales-tax treatment).
final_tax_amount = Number((final_subtotal * trusted_tax_rate).toFixed(2))
final_total = Number((final_subtotal + final_tax_amount + server_shipping_amount).toFixed(2))
}
}

// Insert order into database
const { data, error } = await supabase
.from('orders')
.insert({
order_number,
customer_name,
customer_email,
customer_phone,
shipping_address: {
...shipping_address_with_tax,
subtotal: final_subtotal,
tax_amount: final_tax_amount,
discount_amount: server_discount_amount,
subtotal_before_discount: server_subtotal_before_discount,
},
payment_method,
line_items: validated_line_items,
total: final_total,
payment_status: 'pending',
fulfillment_status: 'pending',
affiliate_code: affiliate_code_clean,
affiliate_id,
discount_amount: server_discount_amount,
subtotal_before_discount: server_subtotal_before_discount,
})
.select('id')
.single()

if (error) {
console.error('Supabase error:', error)
Sentry.captureException(new Error('Supabase order insert failed'), {
extra: {
supabase_error: error,
customer_email,
order_number,
},
tags: { area: 'orders', failure: 'supabase-insert' },
})
return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
}

// ── Write the sticky attribution row, first time only ─────────────────
// After the order is committed, lock this customer to the resolved
// affiliate. Conflict is impossible because the lookup above would have
// hit it; but we guard with onConflict do-nothing semantics so a race
// can never duplicate-insert.
if (should_write_attribution && email_lower && affiliate_code_clean) {
try {
await supabase
.from('customer_affiliate_attribution')
.upsert({
customer_email: email_lower,
affiliate_code: affiliate_code_clean,
affiliate_id: affiliate_id,
first_order_number: order_number,
}, { onConflict: 'customer_email', ignoreDuplicates: true })
} catch (attrErr) {
// Non-fatal; the order is already saved and tagged correctly.
console.error('Sticky attribution write failed:', attrErr)
}
}

const order = {
id: data.id,
order_number,
customer_name,
customer_email,
// Embed AFTER-discount totals + discount fields so email + QBO sync
// both see the right numbers. Without these overrides, downstream
// builds (confirmation email subtotal/tax/total + QBO invoice line
// items + discount line) silently used the pre-discount values.
shipping_address: {
...shipping_address_with_tax,
subtotal: final_subtotal,
tax_amount: final_tax_amount,
discount_amount: server_discount_amount,
subtotal_before_discount: server_subtotal_before_discount,
},
payment_method,
line_items: validated_line_items,
subtotal: final_subtotal,
tax_amount: final_tax_amount,
tax_rate: trusted_tax_rate,
shipping_method: trusted_shipping_method,
shipping_amount: server_shipping_amount,
total: final_total,
affiliate_code: affiliate_code_clean,
discount_amount: server_discount_amount,
subtotal_before_discount: server_subtotal_before_discount,
}

// Fan out three independent side effects:
// 1. Customer order confirmation (Resend)
// 2. Admin "order received" alert — fires regardless of QBO health, so we
// never go blind on orders again when token rotation breaks
// 3. QuickBooks invoice sync (which itself sends the PDF email on success)
// None of these can fail the order — they're all .catch'd to Sentry/console.
await Promise.all([
sendOrderConfirmationEmail(order).catch(e => console.error('Customer email failed:', e)),
sendOrderReceivedAlert(order).catch(e => {
console.error('Admin order-received alert failed:', e)
Sentry.captureException(e, {
extra: { order_number, customer_email },
tags: { area: 'orders', failure: 'admin-alert' },
})
}),
syncToQuickBooks(order).catch(e => {
console.error('QuickBooks sync failed:', { order_number, customer_name, customer_email, error: e?.message, stack: e?.stack, raw: String(e) })
Sentry.captureException(e, {
extra: { order_number, customer_email },
tags: { area: 'orders', failure: 'quickbooks-sync' },
})
}),
broadcastOrderNotification(order).catch(e => {
console.error('Push notification broadcast failed:', e?.message)
// Notification is best-effort — never block or fail the order
})
])

return NextResponse.json({ orderId: data.id, orderNumber: order_number })
} catch (err) {
console.error('Order creation error:', err)
Sentry.captureException(err, {
tags: { area: 'orders', failure: 'unhandled' },
})
return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}
}

export async function GET(request) {
// Admin only: list all orders
const authFail = requireAdmin(request)
if (authFail) return authFail

const supabase = createServerClient()
const { data, error } = await supabase
.from('orders')
.select('*')
.order('created_at', { ascending: false })

if (error) return NextResponse.json({ error: error.message }, { status: 500 })
return NextResponse.json({ orders: data })
}
