'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AdminOrderDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [trackingInput, setTrackingInput] = useState('')
  const [notesInput, setNotesInput] = useState('')
  const [message, setMessage] = useState('')

  const adminKey = typeof window !== 'undefined' ? sessionStorage.getItem('forge-admin-key') : ''

  useEffect(() => {
    if (!adminKey) { router.push('/admin'); return }
    fetch(`/api/orders/${id}`)
      .then(r => r.json())
      .then(d => {
        setOrder(d.order)
        setTrackingInput(d.order?.tracking_number || '')
        setNotesInput(d.order?.notes || '')
        setLoading(false)
      })
  }, [id, adminKey, router])

  async function updateStatus(updates) {
    setSaving(true)
    setMessage('')
    const res = await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
      body: JSON.stringify(updates),
    })
    const data = await res.json()
    if (res.ok) {
      setOrder(data.order)
      setMessage('✓ Order updated')
    } else {
      setMessage('Error: ' + data.error)
    }
    setSaving(false)
  }

  if (loading) return <div className="flex items-center justify-center py-24"><p className="text-gray-400">Loading…</p></div>
  if (!order) return <div className="text-center py-24"><p className="text-gray-400">Order not found</p></div>

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin" className="text-xs text-gray-400 hover:text-gray-600">← Orders</Link>
        <span className="text-gray-200">/</span>
        <span className="text-sm font-bold text-[#0d1b2a]">{order.order_number}</span>
      </div>

      <div className="grid gap-5">

        {/* Order header */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-[#0d1b2a]">{order.order_number}</h1>
              <p className="text-xs text-gray-400 mt-1">{new Date(order.created_at).toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-[#0d1b2a]">${order.total.toFixed(2)}</p>
              <p className="text-xs text-gray-400">via {order.payment_method}</p>
            </div>
          </div>
        </div>

        {/* Customer */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-bold text-sm uppercase tracking-widest text-[#0d1b2a] mb-3">Customer</h2>
          <p className="font-medium">{order.customer_name}</p>
          <p className="text-sm text-gray-500">{order.customer_email}</p>
          {order.customer_phone && <p className="text-sm text-gray-500">{order.customer_phone}</p>}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Ship To</p>
            <p className="text-sm text-gray-600">
              {order.shipping_address.street}<br />
              {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.zip}
            </p>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-bold text-sm uppercase tracking-widest text-[#0d1b2a] mb-3">Items</h2>
          <div className="space-y-2">
            {order.line_items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-700">{item.name} <span className="text-gray-400">×{item.quantity}</span></span>
                <span className="font-medium">${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            {(() => {
              const sa = order.shipping_address || {}
              const sub = sa.subtotal
              const tax = sa.tax_amount
              const shipAmt = Number(sa.shipping_amount ?? 0)
              const shipMethod = sa.shipping_method
              const shipLabel = shipMethod === 'local_delivery' ? 'Local Delivery' : 'FedEx 2-Day'
              return (
                <div className="border-t pt-2 space-y-1">
                  {sub != null && (
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Subtotal</span><span>${Number(sub).toFixed(2)}</span>
                    </div>
                  )}
                  {tax != null && Number(tax) > 0 && (
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Tax</span><span>${Number(tax).toFixed(2)}</span>
                    </div>
                  )}
                  {shipMethod && (
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Shipping ({shipLabel})</span>
                      <span>{shipAmt === 0 ? 'FREE' : `$${shipAmt.toFixed(2)}`}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold pt-1 border-t">
                    <span>Total</span><span>${order.total.toFixed(2)}</span>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>

        {/* Status controls */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-bold text-sm uppercase tracking-widest text-[#0d1b2a] mb-4">Update Status</h2>

          {message && (
            <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${message.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {message}
            </div>
          )}

          {/* Payment status */}
          <div className="mb-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Payment Status</p>
            <div className="flex gap-2 flex-wrap">
              {['pending','paid','failed'].map(s => (
                <button key={s} disabled={saving || order.payment_status === s}
                  onClick={() => updateStatus({ payment_status: s })}
                  className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-colors
                    ${order.payment_status === s
                      ? s === 'paid' ? 'bg-green-600 text-white' : s === 'failed' ? 'bg-red-600 text-white' : 'bg-yellow-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                  {s === 'paid' ? '✓ Mark Paid' : s === 'failed' ? '✗ Mark Failed' : 'Pending'}
                </button>
              ))}
            </div>
          </div>

          {/* Fulfillment status */}
          <div className="mb-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Fulfillment Status</p>
            <div className="flex gap-2 flex-wrap">
              {['pending','processing','shipped','delivered'].map(s => (
                <button key={s} disabled={saving || order.fulfillment_status === s}
                  onClick={() => updateStatus({ fulfillment_status: s })}
                  className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-colors
                    ${order.fulfillment_status === s ? 'bg-[#0d1b2a] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Tracking number */}
          <div className="mb-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Tracking Number</p>
            <div className="flex gap-2">
              <input value={trackingInput} onChange={e => setTrackingInput(e.target.value)}
                placeholder="Enter tracking number"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2196f3]" />
              <button disabled={saving} onClick={() => updateStatus({ tracking_number: trackingInput, fulfillment_status: 'shipped' })}
                className="bg-[#0d1b2a] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#1a2e45] transition-colors">
                Save + Mark Shipped
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Saving tracking number will automatically mark as Shipped and email customer</p>
          </div>

          {/* Notes */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Internal Notes</p>
            <textarea value={notesInput} onChange={e => setNotesInput(e.target.value)} rows={3}
              placeholder="Add internal notes (not visible to customer)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2196f3] resize-none" />
            <button disabled={saving} onClick={() => updateStatus({ notes: notesInput })}
              className="mt-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors">
              Save Notes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
