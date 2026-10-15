'use client'

import { useState, useEffect } from 'react'
import { useCart } from '../../components/CartContext'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useUser, SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs'
import { computeShipping, shippingLabel, FREE_SHIPPING_THRESHOLD } from '../../lib/shipping'
import { getProductBySlug } from '../../lib/products'
import { computeBulkDiscount, chooseDiscount, BULK_DISCOUNT_LABEL } from '../../lib/bulkDiscount'
import { suggestEmailCorrection } from '../../lib/emailCheck'
import { normalizeCreditCode, looksLikeCreditCode, STORE_CREDIT_LABEL } from '../../lib/storeCredit'
import { canCheckFirstOrder, firstOrderAmount, FIRST_ORDER_LABEL, FIRST_ORDER_PCT } from '../../lib/firstOrder'

const US_STATES = [
'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
'VA','WA','WV','WI','WY'
]

export default function CheckoutPage() {
const { cart, cartTotal, clearCart } = useCart()

// Compounded Pharmacy (LAB "prescription") products require DOB capture
// at checkout per pharmacy/compliance request.
const requiresDob = cart.some(i => getProductBySlug(i.slug)?.prescription)
const router = useRouter()
const { user, isSignedIn } = useUser()

// Pre-fill form from Clerk profile when signed in
useEffect(() => {
if (isSignedIn && user) {
const saved = user.unsafeMetadata?.shippingAddress || {}
setForm(prev => ({
...prev,
firstName: prev.firstName || user.firstName || '',
lastName: prev.lastName || user.lastName || '',
email: prev.email || user.primaryEmailAddress?.emailAddress || '',
phone: prev.phone || user.primaryPhoneNumber?.phoneNumber || '',
street: prev.street || saved.street || '',
city: prev.city || saved.city || '',
state: prev.state || saved.state || '',
zip: prev.zip || saved.zip || '',
}))
}
}, [isSignedIn, user])

const [loading, setLoading] = useState(false)
const [error, setError] = useState('')
const [emailCheck, setEmailCheck] = useState(null) // { suggestion } | { warning: true } | null
const [form, setForm] = useState({
firstName: '',
lastName: '',
email: '',
phone: '',
street: '',
city: '',
state: '',
zip: '',
paymentMethod: 'venmo',
shippingMethod: 'fedex_2day',
affiliateCode: '',
  promoCode: '',
  storeCreditCode: '',
  dob: '',
})

// Live tax rate from TaxJar (includes state + county + city)
const [taxData, setTaxData] = useState(null) // full TaxJar rate object
const [taxLoading, setTaxLoading] = useState(false)
const [affPreview, setAffPreview] = useState(null) // { valid, discount_pct, name } or null
const [affLoading, setAffLoading] = useState(false)
const [promoPreview, setPromoPreview] = useState(null)
const [promoLoading, setPromoLoading] = useState(false)
// Store credit (single-use dollar credit, e.g. BACK67-T6DVR) — rules in lib/storeCredit.js
const [creditOpen, setCreditOpen] = useState(false) // collapsed behind a link unless a credit is in play
const [creditPreview, setCreditPreview] = useState(null) // { valid, code, amount, min_order, expires_at } | { valid:false, message }
const [creditLoading, setCreditLoading] = useState(false)
// First-order discount (15%, automatic) — rules in lib/firstOrder.js
const [firstOrder, setFirstOrder] = useState(null) // { eligible, checked } | null

// ── Lut Turbo (Pay by Bank / ACH) state ──────────────────────────────────
const [lutCartId] = useState(() => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `cart-${Date.now()}-${Math.random().toString(36).slice(2)}`)
const [lutSessionId, setLutSessionId] = useState(null)
const [lutStatus, setLutStatus] = useState('idle') // idle | loading_session | widget_open | checking_status | captured | error
const [lutError, setLutError] = useState('')
const [lutCapture, setLutCapture] = useState(null) // { payToken, merchantId, achAccountLast4, achRoutingLast4 }
const LUT_WIDGET_URL = process.env.NEXT_PUBLIC_LUT_WIDGET_URL || 'https://turbo-myportal.demo.mylut.com/paybybank/payByBankWidget.js'


// Auto-apply affiliate code from ?ref= URL param OR sessionStorage (set by AffiliateTracker in layout)
useEffect(() => {
const params = new URLSearchParams(window.location.search)
const refCode = (params.get('ref') || sessionStorage.getItem('affiliateRef') || '').trim().toUpperCase()
if (!refCode) return
setForm(f => ({ ...f, affiliateCode: refCode }))
setAffLoading(true)
fetch('/api/affiliate/preview', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
cache: 'no-store',
body: JSON.stringify({ code: refCode, email: '', line_items: [] }),
})
.then(r => r.json())
.then(j => setAffPreview(j?.valid ? j : { valid: false }))
.catch(() => setAffPreview({ valid: false }))
.finally(() => setAffLoading(false))
}, [])

// Pre-fill a store credit code from the win-back email link (?credit=CODE),
// captured on any page by AffiliateTracker. Applied once an email is entered.
useEffect(() => {
const params = new URLSearchParams(window.location.search)
const c = normalizeCreditCode(params.get('credit') || sessionStorage.getItem('storeCredit') || '')
if (c) setForm(f => ({ ...f, storeCreditCode: c }))
}, [])

// Check first-order eligibility once email + street + ZIP are filled in
// (phone used when present). Debounced; the orders API re-checks.
useEffect(() => {
const input = { email: form.email, phone: form.phone, street: form.street, zip: form.zip }
if (!canCheckFirstOrder(input)) { setFirstOrder(null); return }
const timer = setTimeout(async () => {
try {
const r = await fetch('/api/first-order/check', {
method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
body: JSON.stringify(input),
})
const j = await r.json()
setFirstOrder({ eligible: !!j?.eligible, checked: !!j?.checked })
} catch {
setFirstOrder(null)
}
}, 700)
return () => clearTimeout(timer)
}, [form.email, form.phone, form.street, form.zip])

useEffect(() => {
// Need at least a 5-digit zip and a state to look up
if (!form.state || !form.zip || form.zip.replace(/\D/g, '').length < 5) {
setTaxData(null)
return
}
setTaxLoading(true)
const timer = setTimeout(async () => {
try {
const params = new URLSearchParams({ zip: form.zip, state: form.state })
if (form.city) params.set('city', form.city)
const res = await fetch(`/api/tax-rate?${params}`)
if (res.ok) {
const data = await res.json()
setTaxData(data)
}
} catch (e) {
console.error('Tax lookup failed:', e)
} finally {
setTaxLoading(false)
}
}, 600) // 600ms debounce
return () => clearTimeout(timer)
}, [form.zip, form.state, form.city])

const combinedRate = taxData ? parseFloat(taxData.combined_rate) : 0
// Affiliate code discount
const affDiscountPct = affPreview?.valid && affPreview.discount_pct > 0 ? affPreview.discount_pct : 0
const affDiscountFromPct = Math.round(cartTotal * affDiscountPct * 100) / 100
const affDiscountFromAmt = affPreview?.valid && Number(affPreview.discount_amount) > 0 ? Number(affPreview.discount_amount) : 0
const affDiscountAmount = Math.max(affDiscountFromPct, affDiscountFromAmt)

// Promo code discount
const promoDiscountPct = promoPreview?.valid && promoPreview.discount_pct > 0 ? promoPreview.discount_pct : 0
const promoDiscountFromPct = Math.round(cartTotal * promoDiscountPct * 100) / 100
const promoDiscountFromAmt = promoPreview?.valid && Number(promoPreview.discount_amount) > 0 ? Number(promoPreview.discount_amount) : 0
const promoDiscountAmount = Math.max(promoDiscountFromPct, promoDiscountFromAmt)

// Combined discount from both codes
const codeDiscountAmount = affDiscountAmount + promoDiscountAmount

// Multi-vial discount (5+ = 20%, 10+ = 30% per item) — never stacked with
// codes. Mirrors the server rule in app/api/orders/route.js via
// lib/bulkDiscount.js: the order gets whichever saves more; member pricing
// codes (OWNERS) are exempt.
const bulk = computeBulkDiscount(cart)
const bulkByslug = Object.fromEntries(bulk.per_line.map(l => [l.slug, l]))
const memberPricing = !!(affPreview?.valid && affPreview.member_pricing && affDiscountAmount > 0)
const firstOrderAmt = firstOrder?.eligible ? firstOrderAmount(cartTotal) : 0
const discountChoice = chooseDiscount({ bulkAmount: bulk.discount_amount, codeAmount: codeDiscountAmount, firstOrderAmount: firstOrderAmt, memberPricing })
const bulkApplied = discountChoice === 'bulk'
const firstOrderApplied = discountChoice === 'first_order'
const codeDeclinedForFirst = firstOrderApplied && codeDiscountAmount > 0
const codesApplied = discountChoice === 'code' || discountChoice === 'member'
const typedCode = (affPreview?.valid ? (affPreview.code || form.affiliateCode.trim().toUpperCase()) : '') ||
(promoPreview?.valid ? (promoPreview.code || form.promoCode.trim().toUpperCase()) : '')
// Customer typed a code that carries a discount, and the multi-vial discount won.
const codeDeclinedForBulk = bulkApplied && codeDiscountAmount > 0
// Customer's code beat the multi-vial discount (e.g. FAMILY pricing).
const bulkDeclinedForCode = discountChoice === 'code' && bulk.discount_amount > 0

const discountAmount = bulkApplied ? bulk.discount_amount : firstOrderApplied ? firstOrderAmt : (codesApplied ? codeDiscountAmount : 0)
// Store credit stacks with everything and comes off last. The minimum order
// is checked against the product subtotal before discounts; the credit never
// takes the subtotal below $0. The orders API re-checks all of this.
const creditMinOrder = creditPreview?.valid ? Number(creditPreview.min_order || 0) : 0
const creditBelowMin = !!creditPreview?.valid && cartTotal < creditMinOrder
const creditAmount = creditPreview?.valid && !creditBelowMin
? Math.round(Math.min(Number(creditPreview.amount || 0), Math.max(0, cartTotal - discountAmount)) * 100) / 100
: 0
const subtotalAfter = Math.max(0, cartTotal - discountAmount - creditAmount)
const taxAmount = Math.round(subtotalAfter * combinedRate * 100) / 100
// Shipping is computed in lib/shipping so the rule lives in exactly one place.
// Tax base stays on subtotal only — shipping is not taxed.
const shippingAmount = computeShipping(cartTotal, form.shippingMethod)
const orderTotal = subtotalAfter + taxAmount + shippingAmount
// Lut Turbo charges 3.95% + $0.30 per ACH transaction. Passed through to
// the customer as a surcharge (disclosed before they link their bank
// account) rather than silently absorbed — mirrors the server-side
// calculation in app/api/orders/route.js.
const lutFeeAmount = form.paymentMethod === 'lut_ach' ? Math.round((orderTotal * 0.0395 + 0.30) * 100) / 100 : 0
const grandTotal = orderTotal + lutFeeAmount

function handleChange(e) {
setForm(f => ({ ...f, [e.target.name]: e.target.value }))
if (e.target.name === 'affiliateCode') setAffPreview(null)
if (e.target.name === 'promoCode') setPromoPreview(null)
if (e.target.name === 'storeCreditCode') setCreditPreview(null)
if (e.target.name === 'email') { setEmailCheck(null); setCreditPreview(null) }
}

function handleEmailBlur() {
setEmailCheck(suggestEmailCorrection(form.email))
// A credit code pre-filled from the email link applies once there's an email.
if (form.storeCreditCode.trim() && !creditPreview && /.+@.+\..+/.test(form.email.trim())) applyStoreCredit()
}

function acceptEmailSuggestion() {
if (emailCheck?.suggestion) {
setForm(f => ({ ...f, email: emailCheck.suggestion }))
}
setEmailCheck(null)
}

async function applyStoreCredit(codeOverride) {
const code = normalizeCreditCode(codeOverride ?? form.storeCreditCode)
if (!code) { setCreditPreview(null); return }
setCreditLoading(true)
try {
const r = await fetch('/api/store-credit/preview', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
cache: 'no-store',
body: JSON.stringify({
code,
email: form.email,
line_items: cart.map(i => ({ slug: i.slug, quantity: i.quantity })),
}),
})
const j = await r.json()
// A code that's valid but short of its minimum still counts as "yours";
// keep it so the summary can tell the customer how much more to add.
if (j?.valid) setCreditPreview(j)
else if (j?.reason === 'below_minimum') setCreditPreview({ valid: true, code: j.code, amount: j.amount, min_order: j.min_order })
else setCreditPreview({ valid: false, message: j?.message || 'That credit code isn’t valid.' })
} catch {
setCreditPreview({ valid: false, message: 'Couldn’t check that code right now — please try again.' })
} finally {
setCreditLoading(false)
}
}

async function applyAffiliateCode() {
const raw = (form.affiliateCode || '').trim()
if (!raw) { setAffPreview(null); return }
// A store credit code typed into the affiliate box: move it to its own box.
if (looksLikeCreditCode(raw)) {
const c = normalizeCreditCode(raw)
setForm(f => ({ ...f, affiliateCode: '', storeCreditCode: c }))
setAffPreview(null)
applyStoreCredit(c)
return
}
setAffLoading(true)
try {
const r = await fetch('/api/affiliate/preview', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
cache: 'no-store',
body: JSON.stringify({
code: raw,
email: form.email,
line_items: cart.map(i => ({
id: i.id, slug: i.slug, name: i.name, qbo_name: i.qbo_name,
price: i.price, quantity: i.quantity,
})),
}),
})
const j = await r.json()
setAffPreview(j?.valid ? j : { valid: false })
} catch {
setAffPreview({ valid: false })
} finally {
setAffLoading(false)
}
}

async function applyPromoCode() {
const raw = (form.promoCode || '').trim()
if (!raw) { setPromoPreview(null); return }
setPromoLoading(true)
try {
const r = await fetch('/api/affiliate/preview', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
cache: 'no-store',
body: JSON.stringify({
code: raw,
email: form.email,
line_items: cart.map(i => ({
id: i.id, slug: i.slug, name: i.name, qbo_name: i.qbo_name,
price: i.price, quantity: i.quantity,
})),
}),
})
const j = await r.json()
setPromoPreview(j?.valid ? j : { valid: false })
} catch {
setPromoPreview({ valid: false })
} finally {
setPromoLoading(false)
}
}

// ── Lut Turbo (Pay by Bank / ACH) flow ──────────────────────────────────
// 1. createSession -> 2. load PayByBank widget -> 3. on widget close, poll
// cart-status for the payToken -> 4. store it; handleSubmit sends it along
// with the order so the server can charge it via the trusted total.
async function startLutPayByBank() {
setLutError('')
setLutStatus('loading_session')
try {
const res = await fetch('/api/lut/create-session', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ cartId: lutCartId }),
})
const j = await res.json()
if (!res.ok || !j.sessionId) throw new Error(j.error || 'Could not start bank payment session')
setLutSessionId(j.sessionId)
setLutStatus('widget_open')
loadLutWidget(j.sessionId)
} catch (e) {
setLutError(e.message || 'Could not start bank payment session')
setLutStatus('error')
}
}

function loadLutWidget(sessionId) {
// The Lut PayByBank script doesn't auto-open on load: it exposes an
// imperative window.PayByBankWidget.open(config) API. Passing
// modalPopup: true tells the widget's own render logic to add its
// "pbb-modal-mode" host class AND wire up click-outside-to-close —
// both come for free from the widget itself this way (confirmed by
// reading the widget's source), so we don't need to touch its DOM.
function openWidget() {
if (!window.PayByBankWidget) return
window.PayByBankWidget.open({
firstName: form.firstName || '',
lastName: form.lastName || '',
email: form.email || '',
sessionId,
cartId: lutCartId,
modalPopup: true,
onClose: () => { checkLutCartStatus() },
onError: (err) => { setLutError(err?.message || 'Something went wrong linking your bank account. Please try again.'); setLutStatus('error') },
})
}

// Remove any previous instance of the widget script before re-adding
const prev = document.getElementById('paybybank-script')
if (prev) prev.remove()

const script = document.createElement('script')
script.id = 'paybybank-script'
script.src = LUT_WIDGET_URL
script.onload = openWidget
document.body.appendChild(script)
}

// Listen once for the widget closing, then fetch the resulting status/token.
useEffect(() => {
function onWidgetResult() {
checkLutCartStatus()
}
window.addEventListener('pbb:result', onWidgetResult)
return () => window.removeEventListener('pbb:result', onWidgetResult)
}, [lutSessionId, lutCartId])

async function checkLutCartStatus() {
if (!lutSessionId) return
setLutStatus('checking_status')
try {
const res = await fetch(`/api/lut/cart-status?sessionId=${encodeURIComponent(lutSessionId)}&cartId=${encodeURIComponent(lutCartId)}`, { cache: 'no-store' })
const j = await res.json()
if (!res.ok) throw new Error(j.error || 'Could not confirm bank account status')
if (j.sessionStatus === 'CAPTURED' && j.payTokenStatus === 'ACTIVE') {
setLutCapture({
payToken: j.payToken,
merchantId: j.merchantId,
achAccountLast4: j.achAccountLast4,
achRoutingLast4: j.achRoutingLast4,
})
setLutStatus('captured')
} else {
setLutError('Bank account was not linked — please try again.')
setLutStatus('error')
}
} catch (e) {
setLutError(e.message || 'Could not confirm bank account status')
setLutStatus('error')
}
}

async function handleSubmit(e) {
e.preventDefault()
if (cart.length === 0) return
if (form.paymentMethod === 'lut_ach' && (lutStatus !== 'captured' || !lutCapture?.payToken)) {
setError('Please link your bank account before placing your order.')
return
}
if (requiresDob && !form.dob) {
setError('Date of birth is required to order Compounded Pharmacy products.')
return
}
setLoading(true)
setError('')

try {
const res = await fetch('/api/orders', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
customer_name: `${form.firstName} ${form.lastName}`,
customer_email: form.email,
customer_phone: form.phone,
shipping_address: {
street: form.street,
city: form.city,
state: form.state,
zip: form.zip,
},
payment_method: form.paymentMethod,
shipping_method: form.shippingMethod,
affiliate_code: form.affiliateCode || null,
promo_code: form.promoCode || null,
store_credit_code: creditAmount > 0 ? normalizeCreditCode(creditPreview.code || form.storeCreditCode) : null,
date_of_birth: form.dob || null,
...(form.paymentMethod === 'lut_ach' && lutCapture ? {
lut_cart_id: lutCartId,
lut_pay_token: lutCapture.payToken,
lut_merchant_id: lutCapture.merchantId,
ach_account_last4: lutCapture.achAccountLast4,
ach_routing_last4: lutCapture.achRoutingLast4,
} : {}),
line_items: cart.map(i => ({
id: i.id,
slug: i.slug,
name: i.name,
price: i.price,
quantity: i.quantity,
})),
subtotal: cartTotal,
tax_amount: taxAmount,
tax_rate: combinedRate,
total: orderTotal,
}),
})

const data = await res.json()
if (!res.ok) throw new Error(data.error || 'Failed to place order')

clearCart()
if (isSignedIn && user && form.street) {
try {
await user.update({
unsafeMetadata: {
...user.unsafeMetadata,
shippingAddress: { street: form.street, city: form.city, state: form.state, zip: form.zip },
},
})
} catch (e) {
console.warn('Could not save address to profile:', e)
}
}
router.push(`/order/${data.orderId}`)
} catch (err) {
setError(err.message || 'Something went wrong. Please try again.')
setLoading(false)
}
}

if (cart.length === 0) {
return (
<div className="max-w-xl mx-auto px-6 py-24 text-center">
<p className="text-gray-500">Your cart is empty. <a href="/shop" className="text-[#2196f3] font-bold">Shop now →</a></p>
</div>
)
}

return (
<div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
<h1 className="text-2xl font-bold text-[#0d1b2a] mb-6 sm:mb-8 tracking-wide uppercase">Checkout</h1>
{/* ── CLERK SIGN-IN BANNER ── */}
<div className="bg-[#f8f9fa] border border-[#dee2e6] rounded-lg p-4 mb-4 flex items-center justify-between gap-3 flex-wrap">
<SignedOut>
<span className="text-sm text-[#0d1b2a]">
<span className="font-bold">Have an account?</span> Sign in for faster checkout — we&apos;ll pre-fill your info.
</span>
<SignInButton mode="modal">
<button className="text-sm bg-[#0d1b2a] text-white px-4 py-2 rounded-lg hover:bg-[#1a2f47] transition-colors flex-shrink-0">
Sign in
</button>
</SignInButton>
</SignedOut>
<SignedIn>
<div className="flex items-center gap-3">
<UserButton />
<span className="text-sm text-[#0d1b2a]">Signed in — your info has been pre-filled below.</span>
</div>
</SignedIn>
</div>
<form onSubmit={handleSubmit}>
<div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

{/* LEFT: Form */}
<div className="space-y-6">

{/* Contact info */}
<div className="bg-white rounded-lg p-6 shadow-sm">
<h2 className="font-bold text-[#0d1b2a] text-sm tracking-widest uppercase mb-4">Contact Information</h2>
<div className="grid grid-cols-2 gap-4">
<div>
<label className="block text-xs text-gray-500 mb-1 uppercase tracking-wide">First Name *</label>
<input name="firstName" autoComplete="given-name" required value={form.firstName} onChange={handleChange}
className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#2196f3] focus:ring-1 focus:ring-[#2196f3]" />
</div>
<div>
<label className="block text-xs text-gray-500 mb-1 uppercase tracking-wide">Last Name *</label>
<input name="lastName" autoComplete="family-name" required value={form.lastName} onChange={handleChange}
className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#2196f3] focus:ring-1 focus:ring-[#2196f3]" />
</div>
</div>
<div className="mt-4">
<label className="block text-xs text-gray-500 mb-1 uppercase tracking-wide">Email Address *</label>
<input name="email" type="email" autoComplete="email" required value={form.email} onChange={handleChange} onBlur={handleEmailBlur}
className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#2196f3] focus:ring-1 focus:ring-[#2196f3]" />
{emailCheck?.suggestion && (
<p className="text-xs text-amber-700 mt-1.5">
Did you mean <strong>{emailCheck.suggestion}</strong>?{' '}
<button type="button" onClick={acceptEmailSuggestion} className="underline font-semibold hover:text-amber-900">
Use this
</button>
</p>
)}
{emailCheck?.warning && (
<p className="text-xs text-amber-700 mt-1.5">
This email address doesn&apos;t look quite right — please double-check it for typos before continuing.
</p>
)}
</div>
<div className="mt-4">
<label className="block text-xs text-gray-500 mb-1 uppercase tracking-wide">Phone Number</label>
<input name="phone" type="tel" autoComplete="tel" value={form.phone} onChange={handleChange}
className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#2196f3] focus:ring-1 focus:ring-[#2196f3]" />
</div>
{requiresDob && (
<div className="mt-4">
<label className="block text-xs text-gray-500 mb-1 uppercase tracking-wide">Date of Birth *</label>
<input name="dob" type="date" required value={form.dob} onChange={handleChange}
max={new Date().toISOString().slice(0, 10)}
className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#2196f3] focus:ring-1 focus:ring-[#2196f3]" />
<p className="text-[11px] text-gray-500 mt-1">Required for Compounded Pharmacy items in your cart.</p>
</div>
)}
</div>

{/* Shipping address */}
<div className="bg-white rounded-lg p-6 shadow-sm">
<h2 className="font-bold text-[#0d1b2a] text-sm tracking-widest uppercase mb-4">Shipping Address</h2>
<div>
<label className="block text-xs text-gray-500 mb-1 uppercase tracking-wide">Street Address *</label>
<input name="street" autoComplete="street-address" required value={form.street} onChange={handleChange}
placeholder="123 Main St, Apt 4"
className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#2196f3] focus:ring-1 focus:ring-[#2196f3]" />
</div>
<div className="grid grid-cols-2 gap-4 mt-4">
<div>
<label className="block text-xs text-gray-500 mb-1 uppercase tracking-wide">City *</label>
<input name="city" autoComplete="address-level2" required value={form.city} onChange={handleChange}
className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#2196f3] focus:ring-1 focus:ring-[#2196f3]" />
</div>
<div>
<label className="block text-xs text-gray-500 mb-1 uppercase tracking-wide">State *</label>
<select name="state" autoComplete="address-level1" required value={form.state} onChange={handleChange}
className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#2196f3] focus:ring-1 focus:ring-[#2196f3] bg-white">
<option value="">Select</option>
{US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
</select>
</div>
</div>
<div className="mt-4">
<label className="block text-xs text-gray-500 mb-1 uppercase tracking-wide">ZIP Code *</label>
<input name="zip" autoComplete="postal-code" required value={form.zip} onChange={handleChange}
className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#2196f3] focus:ring-1 focus:ring-[#2196f3]" />
</div>
</div>

{/* Shipping method */}
<div className="bg-white rounded-lg p-6 shadow-sm">
<h2 className="font-bold text-[#0d1b2a] text-sm tracking-widest uppercase mb-4">Shipping Method</h2>

<label className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${form.shippingMethod === 'fedex_2day' ? 'border-[#2196f3] bg-[#f0f7ff]' : 'border-gray-200 hover:border-gray-300'}`}>
<input type="radio" name="shippingMethod" value="fedex_2day" checked={form.shippingMethod === 'fedex_2day'} onChange={handleChange} className="sr-only" />
<div className="w-10 h-10 rounded-lg bg-[#4d148c] flex items-center justify-center flex-shrink-0">
<span className="text-white font-bold text-xs">FedEx</span>
</div>
<div className="flex-1">
<p className="font-bold text-[#0d1b2a] text-sm">FedEx 2-Day {cartTotal >= FREE_SHIPPING_THRESHOLD ? <span className="text-green-600">— FREE</span> : <span className="text-gray-500 font-normal">— $12.00</span>}</p>
<p className="text-xs text-gray-500">
{cartTotal >= FREE_SHIPPING_THRESHOLD
? 'You qualify for free shipping (orders $250+)'
: `Add $${(FREE_SHIPPING_THRESHOLD - cartTotal).toFixed(2)} more to qualify for free shipping`}
</p>
</div>
{form.shippingMethod === 'fedex_2day' && <span className="ml-auto text-[#2196f3] font-bold text-lg">✓</span>}
</label>


</div>

{/* Payment method */}
<div className="bg-white rounded-lg p-6 shadow-sm">
<h2 className="font-bold text-[#0d1b2a] text-sm tracking-widest uppercase mb-4">Payment Method</h2>
<p className="text-xs text-gray-500 mb-4">
Select your payment method. You will be shown full payment instructions after placing your order,
and they will also be emailed to you.
</p>

<label className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${form.paymentMethod === 'venmo' ? 'border-[#2196f3] bg-[#f0f7ff]' : 'border-gray-200 hover:border-gray-300'}`}>
<input type="radio" name="paymentMethod" value="venmo" checked={form.paymentMethod === 'venmo'} onChange={handleChange} className="sr-only" />
<div className="w-10 h-10 rounded-lg bg-[#3D95CE] flex items-center justify-center flex-shrink-0">
<span className="text-white font-bold text-sm">V</span>
</div>
<div>
<p className="font-bold text-[#0d1b2a] text-sm">Venmo</p>
<p className="text-xs text-gray-500">Payment details emailed to you after placing order</p>
</div>
{form.paymentMethod === 'venmo' && <span className="ml-auto text-[#2196f3] font-bold text-lg">✓</span>}
</label>

{/* Venmo note warning — shown when Venmo is selected */}
{form.paymentMethod === 'venmo' && (
<div className="mt-3 bg-red-50 border-2 border-red-400 rounded-lg p-4">
<p className="text-red-700 font-bold text-sm mb-1">⚠️ Important Venmo Note Requirement</p>
<p className="text-red-600 text-sm">
You <strong>MUST</strong> write exactly <strong>"Thank you"</strong> in the Venmo comment field.
</p>
<p className="text-red-500 text-xs mt-1">
Any other comment will result in your payment being returned and your order cannot be processed.
</p>
</div>
)}


{/* Pay by Bank (ACH via Lut Turbo) */}
<label className={`mt-3 flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${form.paymentMethod === 'lut_ach' ? 'border-[#2196f3] bg-[#f0f7ff]' : 'border-gray-200 hover:border-gray-300'}`}>
<input type="radio" name="paymentMethod" value="lut_ach" checked={form.paymentMethod === 'lut_ach'} onChange={handleChange} className="sr-only" />
<div className="w-10 h-10 rounded-lg bg-[#5B4FE9] flex items-center justify-center flex-shrink-0">
<span className="text-white font-bold text-xs">ACH</span>
</div>
<div>
<p className="font-bold text-[#0d1b2a] text-sm">Pay by Bank (ACH)</p>
<p className="text-xs text-gray-500">Link your bank account and pay directly — a 3.95% + $0.30 processing fee applies</p>
</div>
{form.paymentMethod === 'lut_ach' && <span className="ml-auto text-[#2196f3] font-bold text-lg">✓</span>}
</label>

{form.paymentMethod === 'lut_ach' && (
<div className="mt-3 bg-[#f0f7ff] border-2 border-[#2196f3]/40 rounded-lg p-4">
{lutStatus === 'captured' && lutCapture ? (
<>
<p className="text-sm font-semibold text-green-700">
✓ Bank account linked — account ending in {lutCapture.achAccountLast4 || '••••'}, routing ending in {lutCapture.achRoutingLast4 || '••••'}
</p>
<p className="text-xs text-gray-500 mt-1">Your bank account will be charged ${grandTotal.toFixed(2)}, which includes a ${lutFeeAmount.toFixed(2)} ACH processing fee (3.95% + $0.30).</p>
</>
) : (
<>
<p className="text-sm text-[#0d1b2a] mb-3">Link your bank account to pay by ACH. You'll enter your account details in a secure window from our payment partner, Lüt Turbo.</p>
<p className="text-xs text-gray-500 mb-3">A processing fee of 3.95% + $0.30 (${lutFeeAmount.toFixed(2)} on this order) is added by our ACH payment partner, bringing your total to ${grandTotal.toFixed(2)}.</p>
<button
type="button"
onClick={startLutPayByBank}
disabled={lutStatus === 'loading_session' || lutStatus === 'widget_open' || lutStatus === 'checking_status'}
className="px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wide bg-[#0d1b2a] text-white hover:bg-[#1a2e45] disabled:opacity-50"
>
{lutStatus === 'loading_session' ? 'Starting…' : lutStatus === 'widget_open' ? 'Waiting for bank info…' : lutStatus === 'checking_status' ? 'Confirming…' : 'Link Bank Account'}
</button>
{lutError && <p className="text-red-500 text-xs mt-2">{lutError}</p>}
</>
)}
</div>
)}
</div>

{error && (
<div className="bg-red-50 border border-red-300 rounded-lg p-4">
<p className="text-red-600 text-sm">{error}</p>
</div>
)}
</div>

{/* RIGHT: Affiliate code + Order summary */}
<div className="space-y-6">
{/* Promo & Affiliate Codes */}
<div className="bg-white rounded-lg p-6 shadow-sm">
<h2 className="font-bold text-[#0d1b2a] text-sm tracking-widest uppercase mb-4">Affiliate Code</h2>

{/* PROMO_CODE_HIDDEN_START */}{false && (<>
{/* Promo Code */}
<div className="mb-5">
<label className="block text-xs text-gray-500 mb-1 uppercase tracking-wide">Promo Code</label>
<p className="text-xs text-gray-400 mb-2">Have a sale or discount code? Enter it here.</p>
<div className="flex gap-2">
<input
name="promoCode"
type="text"
autoComplete="off"
spellCheck="false"
value={form.promoCode}
onChange={handleChange}
placeholder="e.g. SUMMER15"
className="flex-1 px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-[#2196f3] focus:outline-none transition-colors text-sm uppercase tracking-wider"
/>
<button
type="button"
onClick={applyPromoCode}
disabled={promoLoading || !form.promoCode.trim()}
className={`px-4 py-3 rounded-lg text-sm font-bold tracking-wider uppercase transition-all whitespace-nowrap
${promoLoading || !form.promoCode.trim()
? 'bg-gray-100 text-gray-400 cursor-not-allowed'
: 'bg-[#0d1b2a] text-white hover:bg-[#1a2e45] active:scale-95'
}`}
>
{promoLoading ? '…' : 'Apply'}
</button>
</div>
{promoPreview?.valid && (
<p className="mt-1.5 text-xs font-semibold text-green-600">✓ {form.promoCode.trim().toUpperCase()} applied{promoDiscountAmount > 0 ? ` — saving ${promoDiscountAmount.toFixed(2)}` : ''}</p>
)}
{promoPreview && !promoPreview.valid && form.promoCode.trim() && (
<p className="mt-1.5 text-xs text-red-500">Code not recognized — check the spelling and try again.</p>
)}
</div>

<div className="border-t border-gray-100 my-4" />
</>)}{/* PROMO_CODE_HIDDEN_END */}

{/* Affiliate Code */}
<div>
<label className="block text-xs text-gray-500 mb-1 uppercase tracking-wide">Affiliate Code</label>
<p className="text-xs text-gray-400 mb-2">If a Forge Amino sales associate referred you, enter their code so they get credit.</p>
<div className="flex gap-2">
<input
name="affiliateCode"
type="text"
autoComplete="off"
spellCheck="false"
value={form.affiliateCode}
onChange={handleChange}
placeholder="Rep's code"
className="flex-1 px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-[#2196f3] focus:outline-none transition-colors text-sm uppercase tracking-wider"
/>
<button
type="button"
onClick={applyAffiliateCode}
disabled={affLoading || !form.affiliateCode.trim()}
className={`px-4 py-3 rounded-lg text-sm font-bold tracking-wider uppercase transition-all whitespace-nowrap
${affLoading || !form.affiliateCode.trim()
? 'bg-gray-100 text-gray-400 cursor-not-allowed'
: 'bg-[#0d1b2a] text-white hover:bg-[#1a2e45] active:scale-95'
}`}
>
{affLoading ? '…' : 'Apply'}
</button>
</div>
{affPreview?.valid && (
<p className="mt-1.5 text-xs font-semibold text-green-600">✓ {form.affiliateCode.trim().toUpperCase()} applied{affDiscountAmount > 0 && !codeDeclinedForBulk && !codeDeclinedForFirst ? ` — saving $${affDiscountAmount.toFixed(2)}` : ' — affiliate credited'}</p>
)}
{affPreview && !affPreview.valid && form.affiliateCode.trim() && (
<p className="mt-1.5 text-xs text-red-500">Code not recognized — check the spelling and try again.</p>
)}
</div>
</div>

{/* Store Credit — collapsed to a link; opens on click, or by itself when a
    credit is already in play (email link, typed code, or a check result). */}
{!(creditOpen || form.storeCreditCode.trim() || creditPreview) ? (
<div className="-mt-3 px-1 text-right">
<button
type="button"
onClick={() => setCreditOpen(true)}
className="text-xs text-gray-500 underline underline-offset-2 hover:text-[#2196f3] transition-colors"
>
Have a store credit code?
</button>
</div>
) : (
<div className="bg-white rounded-lg p-6 shadow-sm">
<h2 className="font-bold text-[#0d1b2a] text-sm tracking-widest uppercase mb-1">Store Credit</h2>
<p className="text-xs text-gray-400 mb-3">Got a credit code by email? Enter it here. It works with other discounts and comes off your order last.</p>
<div className="flex gap-2">
<input
name="storeCreditCode"
type="text"
autoFocus={creditOpen && !form.storeCreditCode}
autoComplete="off"
spellCheck="false"
value={form.storeCreditCode}
onChange={handleChange}
placeholder="e.g. BACK23-XXXXX"
className="flex-1 min-w-0 px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-[#2196f3] focus:outline-none transition-colors text-sm uppercase tracking-wider"
/>
<button
type="button"
onClick={() => applyStoreCredit()}
disabled={creditLoading || !form.storeCreditCode.trim()}
className={`px-4 py-3 rounded-lg text-sm font-bold tracking-wider uppercase transition-all whitespace-nowrap
${creditLoading || !form.storeCreditCode.trim()
? 'bg-gray-100 text-gray-400 cursor-not-allowed'
: 'bg-[#0d1b2a] text-white hover:bg-[#1a2e45] active:scale-95'
}`}
>
{creditLoading ? '…' : 'Apply'}
</button>
</div>
{!form.email.trim() && form.storeCreditCode.trim() && !creditPreview && (
<p className="mt-1.5 text-xs text-gray-500">Enter your email first — credit codes work with the email they were sent to.</p>
)}
{creditPreview?.valid && !creditBelowMin && (
<p className="mt-1.5 text-xs font-semibold text-green-600">
✓ ${Number(creditPreview.amount).toFixed(0)} credit applied{creditAmount < Number(creditPreview.amount) ? ` (−$${creditAmount.toFixed(2)} on this order)` : ''}
{creditPreview.expires_at ? <span className="font-normal text-gray-500"> · expires {new Date(creditPreview.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span> : null}
</p>
)}
{creditBelowMin && (
<p className="mt-1.5 text-xs text-amber-700">
Your ${Number(creditPreview.amount).toFixed(0)} credit applies to orders of ${creditMinOrder.toFixed(0)} or more. Add ${(creditMinOrder - cartTotal).toFixed(2)} more to use it.
</p>
)}
{creditPreview && !creditPreview.valid && (
<p className="mt-1.5 text-xs text-red-500">{creditPreview.message}</p>
)}
</div>
)}

<div className="bg-white rounded-lg p-6 shadow-sm sticky top-24">
<h2 className="font-bold text-[#0d1b2a] text-sm tracking-widest uppercase mb-4">Order Summary</h2>
{firstOrderApplied ? (
<div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
<strong>Welcome to Forge Amino!</strong> 15% off your first order has been applied.
</div>
) : !firstOrder ? (
<div className="mb-4 rounded-lg border border-blue-100 bg-[#f0f7ff] px-3 py-2 text-xs text-[#0d1b2a]">
<strong>New customer?</strong> 15% off your first order is applied automatically once you enter your email and shipping address.
</div>
) : null}

<div className="space-y-3 mb-4">
{cart.map(item => (
<div key={item.slug} className="flex items-center gap-3">
<div className="relative w-12 h-12 bg-gray-50 rounded flex-shrink-0 overflow-hidden">
{item.image ? (
<Image src={item.image} alt={item.name} fill className="object-contain p-1" />
) : (
<div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#0d1b2a] via-[#15263d] to-[#0d1b2a]">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c9a227" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
<path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/>
<line x1="8.5" y1="2" x2="15.5" y2="2"/>
<line x1="7" y1="16" x2="17" y2="16"/>
</svg>
</div>
)}
</div>
<div className="flex-1 min-w-0">
<p className="text-xs font-bold text-[#0d1b2a] uppercase truncate">{item.name}</p>
<p className="text-xs text-gray-400">Qty: {item.quantity}</p>
{bulkApplied && bulkByslug[item.slug]?.discount > 0 && (
<p className="text-xs font-semibold text-green-700">Multi-vial {Math.round(bulkByslug[item.slug].pct * 100)}% off</p>
)}
</div>
<p className="text-sm font-bold text-[#0d1b2a]">${(item.price * item.quantity).toFixed(2)}</p>
</div>
))}
</div>

<div className="border-t border-gray-100 pt-4 mb-6 space-y-2">
<div className="flex justify-between items-center text-sm text-gray-600">
<span>Subtotal</span>
<span>${cartTotal.toFixed(2)}</span>
</div>

{promoLoading && (
<div className="flex justify-between items-center text-xs text-gray-400">
<span>Checking promo code…</span>
<span className="animate-pulse">—</span>
</div>
)}
{firstOrderApplied && (
<div className="flex justify-between items-center text-sm">
<span className="text-green-700 font-medium">{FIRST_ORDER_LABEL} ({Math.round(FIRST_ORDER_PCT * 100)}% off)</span>
<span className="text-green-700 font-medium">−${firstOrderAmt.toFixed(2)}</span>
</div>
)}
{codeDeclinedForFirst && (
<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 leading-relaxed">
<strong>Your first-order 15% saves more than {typedCode || 'your code'}</strong>{' '}
(${firstOrderAmt.toFixed(2)} vs ${codeDiscountAmount.toFixed(2)}), so we&apos;ve applied 15% instead. Discounts don&apos;t stack.
{affPreview?.valid ? ' Your affiliate still receives credit for this order.' : ''}
</div>
)}
{firstOrder?.eligible && !firstOrderApplied && (bulkApplied || codesApplied) && (
<p className="text-xs text-gray-500 leading-relaxed">
You qualify for 15% off your first order, but your {bulkApplied ? 'multi-vial discount' : (typedCode || 'code')} saves you more, so we&apos;ve applied that instead.
</p>
)}
{bulkApplied && (
<div className="flex justify-between items-center text-sm">
<span className="text-green-700 font-medium">{BULK_DISCOUNT_LABEL}</span>
<span className="text-green-700 font-medium">−${bulk.discount_amount.toFixed(2)}</span>
</div>
)}
{codeDeclinedForBulk && (
<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 leading-relaxed">
<strong>{typedCode || 'Your code'} can&apos;t be combined with the multi-vial discount.</strong>{' '}
Your multi-vial savings (${bulk.discount_amount.toFixed(2)}) beat your code&apos;s discount (${codeDiscountAmount.toFixed(2)}),
so we&apos;ve applied the multi-vial discount instead. Discounts don&apos;t stack.
{affPreview?.valid ? ' Your affiliate still receives credit for this order.' : ''}
</div>
)}
{bulkDeclinedForCode && (
<div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 leading-relaxed">
<strong>Your {typedCode || 'code'} pricing saves you more than the multi-vial discount</strong>{' '}
(${codeDiscountAmount.toFixed(2)} vs ${bulk.discount_amount.toFixed(2)}), so we&apos;ve applied {typedCode || 'your code'} instead. Discounts don&apos;t stack.
</div>
)}
{bulkApplied && !codeDeclinedForBulk && (
<p className="text-xs text-gray-500 leading-relaxed">The multi-vial discount can&apos;t be combined with discount codes.</p>
)}
{codesApplied && promoPreview?.valid && promoDiscountAmount > 0 && (
<div className="flex justify-between items-center text-sm">
<span className="text-green-700 font-medium">
{promoPreview.code || form.promoCode.trim().toUpperCase()} promo
{promoDiscountPct > 0 ? ` (${(promoDiscountPct * 100).toFixed(0)}% off)` : ''}
</span>
<span className="text-green-700 font-medium">−${promoDiscountAmount.toFixed(2)}</span>
</div>
)}
{promoPreview?.valid && promoDiscountAmount === 0 && (
<div className="flex justify-between items-center text-sm text-green-700 font-medium">
<span>{form.promoCode.trim().toUpperCase()} — applied</span>
<span>✓</span>
</div>
)}
{affLoading && (
<div className="flex justify-between items-center text-xs text-gray-400">
<span>Checking affiliate code…</span>
<span className="animate-pulse">—</span>
</div>
)}
{codesApplied && affPreview?.valid && affDiscountAmount > 0 && (
<div className="flex justify-between items-center text-sm">
<span className="text-green-700 font-medium">
{affPreview.code || form.affiliateCode.trim().toUpperCase()} discount
{affDiscountPct > 0 ? ` (${(affDiscountPct * 100).toFixed(0)}% off)` : (affPreview.discount_to_cost ? ` (cost pricing)` : '')}
</span>
<span className="text-green-700 font-medium">−${affDiscountAmount.toFixed(2)}</span>
</div>
)}
{affPreview?.valid && affDiscountAmount === 0 && (
<div className="flex justify-between items-center text-sm text-green-700 font-medium">
<span>{form.affiliateCode.trim().toUpperCase()} — affiliate credited</span>
<span>✓</span>
</div>
)}
{creditAmount > 0 && (
<div className="flex justify-between items-center text-sm">
<span className="text-green-700 font-medium">{STORE_CREDIT_LABEL} ({normalizeCreditCode(creditPreview.code || form.storeCreditCode)})</span>
<span className="text-green-700 font-medium">−${creditAmount.toFixed(2)}</span>
</div>
)}
{(discountAmount > 0 || creditAmount > 0) && (
<div className="flex justify-between items-center text-sm text-gray-600 font-medium pt-1">
<span>Subtotal after discount</span>
<span>${subtotalAfter.toFixed(2)}</span>
</div>
)}
{affPreview && !affPreview.valid && form.affiliateCode.trim() && (
<p className="text-xs text-gray-400">Affiliate code not recognized — order will proceed without a discount.</p>
)}

{/* Tax lines */}
{taxLoading ? (
<div className="flex justify-between items-center text-sm text-gray-400">
<span>Tax</span>
<span className="animate-pulse">Calculating…</span>
</div>
) : taxData ? (
<div className="space-y-1">
{parseFloat(taxData.state_rate) > 0 && (
<div className="flex justify-between items-center text-xs text-gray-500 pl-2">
<span>{taxData.state} State ({(parseFloat(taxData.state_rate) * 100).toFixed(2).replace(/\.00$/, '')}%)</span>
<span>${(subtotalAfter * parseFloat(taxData.state_rate)).toFixed(2)}</span>
</div>
)}
{taxData.county && parseFloat(taxData.county_rate) > 0 && (
<div className="flex justify-between items-center text-xs text-gray-500 pl-2">
<span>{taxData.county} Co. ({(parseFloat(taxData.county_rate) * 100).toFixed(2).replace(/\.00$/, '')}%)</span>
<span>${(subtotalAfter * parseFloat(taxData.county_rate)).toFixed(2)}</span>
</div>
)}
{taxData.city && parseFloat(taxData.city_rate) > 0 && (
<div className="flex justify-between items-center text-xs text-gray-500 pl-2">
<span>{taxData.city} City ({(parseFloat(taxData.city_rate) * 100).toFixed(2).replace(/\.00$/, '')}%)</span>
<span>${(subtotalAfter * parseFloat(taxData.city_rate)).toFixed(2)}</span>
</div>
)}
{parseFloat(taxData.combined_district_rate) > 0 && (
<div className="flex justify-between items-center text-xs text-gray-500 pl-2">
<span>District ({(parseFloat(taxData.combined_district_rate) * 100).toFixed(2).replace(/\.00$/, '')}%)</span>
<span>${(subtotalAfter * parseFloat(taxData.combined_district_rate)).toFixed(2)}</span>
</div>
)}
<div className="flex justify-between items-center text-sm text-gray-600 font-medium pt-1">
<span>Tax Total ({(combinedRate * 100).toFixed(2).replace(/\.00$/, '')}%)</span>
<span>${taxAmount.toFixed(2)}</span>
</div>
</div>
) : (
<div className="flex justify-between items-center text-sm text-gray-400">
<span>Tax</span>
<span>{form.state && form.zip ? 'Enter full ZIP to calculate' : '—'}</span>
</div>
)}

{/* Shipping row */}
<div className="flex justify-between items-center text-sm">
<span className="text-gray-600 flex items-center gap-1">
Shipping
<span className="text-xs text-gray-400">({shippingLabel(form.shippingMethod)})</span>
</span>
{shippingAmount === 0 ? (
<span className="text-green-600 font-semibold text-sm">FREE</span>
) : (
<span className="text-gray-700">${shippingAmount.toFixed(2)}</span>
)}
</div>
{form.shippingMethod === 'fedex_2day' && cartTotal < FREE_SHIPPING_THRESHOLD && (
<p className="text-xs text-[#2196f3] pl-0">
Add ${(FREE_SHIPPING_THRESHOLD - cartTotal).toFixed(2)} more for free shipping
</p>
)}

{form.paymentMethod === 'lut_ach' && (
<div className="flex justify-between items-center text-sm">
<span className="text-gray-600 flex items-center gap-1">
ACH Processing Fee
<span className="text-xs text-gray-400">(3.95% + $0.30)</span>
</span>
<span className="text-gray-700">${lutFeeAmount.toFixed(2)}</span>
</div>
)}

<div className="flex justify-between items-center pt-2 border-t border-gray-100">
<span className="font-bold text-[#0d1b2a]">Total</span>
<span className="font-bold text-[#0d1b2a] text-xl">${grandTotal.toFixed(2)}</span>
</div>
<p className="text-xs text-gray-400 text-center">All orders ship to the United States only.</p>
</div>

<button
type="submit"
disabled={loading || (form.paymentMethod === 'lut_ach' && lutStatus !== 'captured')}
className={`w-full py-4 rounded-full font-bold tracking-widest uppercase text-sm transition-all
${loading || (form.paymentMethod === 'lut_ach' && lutStatus !== 'captured')
? 'bg-gray-300 text-gray-500 cursor-not-allowed'
: 'bg-[#0d1b2a] text-white hover:bg-[#1a2e45] active:scale-95'
}`}
>
{loading ? 'Placing Order…' : (form.paymentMethod === 'lut_ach' && lutStatus !== 'captured') ? 'Link Bank Account First' : `Place Order — $${grandTotal.toFixed(2)}`}
</button>

<p className="text-xs text-gray-400 text-center mt-3">
{form.paymentMethod === 'lut_ach'
? `Your bank account will be charged $${grandTotal.toFixed(2)}, including a $${lutFeeAmount.toFixed(2)} ACH processing fee.`
: "No payment taken now. You'll send Venmo after checkout."}
</p>

<p className="text-xs text-gray-500 text-center mt-2">
Order confirmation email will come from <strong>orders@forgeamino.us</strong>
</p>
</div>
</div>
</div>
</form>
</div>
)
}
