'use client'

import { useState, useEffect } from 'react'
import { useCart } from '../../components/CartContext'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useUser, SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY'
]

export default function CheckoutPage() {
  const { cart, cartTotal, clearCart } = useCart()
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
  })

  // Live tax rate from TaxJar (includes state + county + city)
  const [taxData, setTaxData] = useState(null)   // full TaxJar rate object
  const [taxLoading, setTaxLoading] = useState(false)

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
  const taxAmount    = Math.round(cartTotal * combinedRate * 100) / 100
  const orderTotal   = cartTotal + taxAmount

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (cart.length === 0) return
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
        {/* ── CUSTOM REQUEST BANNER ── */}
      <div className="bg-[#f0f7ff] border border-[#2196f3]/30 rounded-lg p-4 mb-6 flex items-start gap-3">
        <span className="text-lg flex-shrink-0">💬</span>
        <p className="text-sm text-[#0d1b2a]">
          <span className="font-bold">Don&apos;t see a product you&apos;re interested in?</span>{' '}
          We&apos;re happy to help source it —{' '}
          <Link href="/contact" className="text-[#2196f3] font-bold hover:underline">contact us →</Link>
        </p>
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
                  <input name="firstName" required value={form.firstName} onChange={handleChange}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#2196f3] focus:ring-1 focus:ring-[#2196f3]" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wide">Last Name *</label>
                  <input name="lastName" required value={form.lastName} onChange={handleChange}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#2196f3] focus:ring-1 focus:ring-[#2196f3]" />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wide">Email Address *</label>
                <input name="email" type="email" required value={form.email} onChange={handleChange}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#2196f3] focus:ring-1 focus:ring-[#2196f3]" />
              </div>
              <div className="mt-4">
                <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wide">Phone Number</label>
                <input name="phone" type="tel" value={form.phone} onChange={handleChange}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#2196f3] focus:ring-1 focus:ring-[#2196f3]" />
              </div>
            </div>

            {/* Shipping address */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h2 className="font-bold text-[#0d1b2a] text-sm tracking-widest uppercase mb-4">Shipping Address</h2>
              <div>
                <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wide">Street Address *</label>
                <input name="street" required value={form.street} onChange={handleChange}
                  placeholder="123 Main St, Apt 4"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#2196f3] focus:ring-1 focus:ring-[#2196f3]" />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wide">City *</label>
                  <input name="city" required value={form.city} onChange={handleChange}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#2196f3] focus:ring-1 focus:ring-[#2196f3]" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wide">State *</label>
                  <select name="state" required value={form.state} onChange={handleChange}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#2196f3] focus:ring-1 focus:ring-[#2196f3] bg-white">
                    <option value="">Select</option>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wide">ZIP Code *</label>
                <input name="zip" required value={form.zip} onChange={handleChange}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#2196f3] focus:ring-1 focus:ring-[#2196f3]" />
              </div>
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
            </div>

            {error && (
              <div className="bg-red-50 border border-red-300 rounded-lg p-4">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}
          </div>

          {/* RIGHT: Order summary */}
          <div>
            <div className="bg-white rounded-lg p-6 shadow-sm sticky top-24">
              <h2 className="font-bold text-[#0d1b2a] text-sm tracking-widest uppercase mb-4">Order Summary</h2>

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
                        <span>${(cartTotal * parseFloat(taxData.state_rate)).toFixed(2)}</span>
                      </div>
                    )}
                    {taxData.county && parseFloat(taxData.county_rate) > 0 && (
                      <div className="flex justify-between items-center text-xs text-gray-500 pl-2">
                        <span>{taxData.county} Co. ({(parseFloat(taxData.county_rate) * 100).toFixed(2).replace(/\.00$/, '')}%)</span>
                        <span>${(cartTotal * parseFloat(taxData.county_rate)).toFixed(2)}</span>
                      </div>
                    )}
                    {taxData.city && parseFloat(taxData.city_rate) > 0 && (
                      <div className="flex justify-between items-center text-xs text-gray-500 pl-2">
                        <span>{taxData.city} City ({(parseFloat(taxData.city_rate) * 100).toFixed(2).replace(/\.00$/, '')}%)</span>
                        <span>${(cartTotal * parseFloat(taxData.city_rate)).toFixed(2)}</span>
                      </div>
                    )}
                    {parseFloat(taxData.combined_district_rate) > 0 && (
                      <div className="flex justify-between items-center text-xs text-gray-500 pl-2">
                        <span>District ({(parseFloat(taxData.combined_district_rate) * 100).toFixed(2).replace(/\.00$/, '')}%)</span>
                        <span>${(cartTotal * parseFloat(taxData.combined_district_rate)).toFixed(2)}</span>
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
                    <span className="text-xs text-gray-400">(FedEx 2-Day)</span>
                  </span>
                  {cartTotal >= 250 ? (
                    <span className="text-green-600 font-semibold text-sm">FREE</span>
                  ) : (
                    <span className="text-gray-500 text-xs">Calculated at fulfillment</span>
                  )}
                </div>
                {cartTotal < 250 && (
                  <p className="text-xs text-[#2196f3] pl-0">
                    Add ${(250 - cartTotal).toFixed(2)} more for free shipping
                  </p>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                  <span className="font-bold text-[#0d1b2a]">Total</span>
                  <span className="font-bold text-[#0d1b2a] text-xl">${orderTotal.toFixed(2)}</span>
                </div>
                <p className="text-xs text-gray-400 text-center">All orders ship to the United States only.</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-4 rounded-full font-bold tracking-widest uppercase text-sm transition-all
                  ${loading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-[#0d1b2a] text-white hover:bg-[#1a2e45] active:scale-95'
                  }`}
              >
                {loading ? 'Placing Order…' : `Place Order — $${orderTotal.toFixed(2)}`}
              </button>

              <p className="text-xs text-gray-400 text-center mt-3">
                No payment taken now. You'll send Venmo after checkout.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
