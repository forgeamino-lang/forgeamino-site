import { createServerClient } from '../../../lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

async function getOrder(id) {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .single()
  return data
}

export default async function OrderConfirmationPage({ params }) {
  const order = await getOrder(params.id)
  if (!order) notFound()

  const firstName = order.customer_name.split(' ')[0]
  const subtotal = order.shipping_address.subtotal ?? order.total
  const taxAmount = order.shipping_address.tax_amount ?? 0
  const taxRate = order.shipping_address.tax_rate ?? 0
  const shippingAmount = Number(order.shipping_address.shipping_amount ?? 0)
  const shippingMethod = order.shipping_address.shipping_method
  const shippingLabel = shippingMethod === 'local_delivery' ? 'Local Delivery' : 'FedEx 2-Day'

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      {/* Success header */}
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-green-600 text-3xl">✓</span>
        </div>
        <h1 className="text-2xl font-bold text-[#0d1b2a] tracking-wide mb-2">Order Received, {firstName}!</h1>
        <p className="text-gray-500">Check your email at <strong>{order.customer_email}</strong> for a copy of these instructions.</p>
      </div>

      {/* Order number */}
      <div className="bg-[#f0f7ff] border-2 border-[#2196f3] rounded-xl p-6 mb-6 text-center">
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Your Order Number</p>
        <p className="text-4xl font-bold text-[#0d1b2a]">{order.order_number}</p>
        <p className="text-xs text-gray-400 mt-2">Save this for reference</p>
      </div>

      {/* PAYMENT INSTRUCTIONS — email callout */}
      <div className="bg-white rounded-xl border-2 border-[#ffc107] shadow-sm mb-6 overflow-hidden">
        <div className="bg-[#ffc107] px-6 py-3">
          <p className="font-bold text-[#0d1b2a] text-sm tracking-wide">⚠️ CHECK YOUR EMAIL TO COMPLETE PAYMENT</p>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-600 mb-4">
            We've sent full payment instructions — including the Venmo handle, amount, and required note — to <strong>{order.customer_email}</strong>.
          </p>
          <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
            <span className="text-sm text-gray-500 font-medium">Amount Due</span>
            <span className="text-xl font-bold text-[#0d1b2a]">${order.total.toFixed(2)}</span>
          </div>
          <div className="mt-4 bg-red-50 border-2 border-red-300 rounded-lg p-4 text-center">
            <p className="text-red-700 font-bold text-sm leading-snug">
              ⛔ You MUST write exactly "Thank you" in the Venmo comment.<br />
              <span className="font-normal text-red-500 text-xs">Any other note = payment returned + order cancelled.</span>
            </p>
          </div>
        </div>
      </div>

      {/* Order summary */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="font-bold text-[#0d1b2a] text-sm tracking-widest uppercase mb-4">Order Summary</h2>
        <div className="space-y-3 mb-4">
          {order.line_items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-gray-600">{item.name} <span className="text-gray-400">×{item.quantity}</span></span>
              <span className="font-medium">${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="border-t pt-3 space-y-2">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          {taxAmount > 0 && (
            <div className="flex justify-between text-sm text-gray-500">
              <span>Tax ({order.shipping_address.state} {((taxRate) * 100).toFixed(2).replace(/\.00$/, '')}%)</span>
              <span>${taxAmount.toFixed(2)}</span>
            </div>
          )}
          {shippingMethod && (
            <div className="flex justify-between text-sm text-gray-500">
              <span>Shipping ({shippingLabel})</span>
              <span>{shippingAmount === 0 ? <span className="text-green-600 font-semibold">FREE</span> : `$${shippingAmount.toFixed(2)}`}</span>
            </div>
          )}
          <div className="flex justify-between font-bold pt-2 border-t">
            <span>Total</span>
            <span>${order.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Shipping address */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
        <h2 className="font-bold text-[#0d1b2a] text-sm tracking-widest uppercase mb-3">Shipping To</h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          {order.customer_name}<br />
          {order.shipping_address.street}<br />
          {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.zip}
        </p>
      </div>

      {/* Next steps */}
      <div className="bg-gray-50 rounded-xl p-6 mb-8">
        <h2 className="font-bold text-[#0d1b2a] text-sm tracking-widest uppercase mb-4">What Happens Next</h2>
        <ol className="space-y-3">
          {[
            'Check your email for payment instructions, then send your Venmo payment with "Thank you" in the note',
            'We verify your payment (usually within a few hours during business hours)',
            'You receive a "Payment Confirmed" email once we see it',
            'Your order ships within 1–2 business days — you\'ll get a tracking number by email',
          ].map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-gray-600">
              <span className="w-6 h-6 rounded-full bg-[#0d1b2a] text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      <div className="text-center">
        <Link href="/shop" className="inline-block text-sm text-gray-500 hover:text-[#0d1b2a] transition-colors">
          ← Continue Shopping
        </Link>
      </div>
    </div>
  )
}
