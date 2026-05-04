'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

const STAFF = ['Angela', 'Mark', 'Sean']
const FULFILLMENT_STATES = ['pending', 'processing', 'shipped', 'delivered']
const PAYMENT_STATES     = ['pending', 'paid', 'failed']

// Active = anything not yet delivered (default view) + last 60 days for context
function isActive(order) {
  return order.fulfillment_status !== 'delivered'
}

// Row-tint logic: pink = needs attention, yellow = in progress, green = done
function rowTone(order) {
  const done = order.payment_status === 'paid' &&
               (order.fulfillment_status === 'shipped' || order.fulfillment_status === 'delivered')
  if (done) return 'bg-green-50'
  if (order.claimed_by) return 'bg-yellow-50'
  return 'bg-pink-50'
}

function summarizeItems(line_items) {
  if (!Array.isArray(line_items)) return ''
  return line_items.map(li => `${li.quantity}× ${li.name}`).join(', ')
}

function deliverOrShip(order) {
  const m = order.shipping_address?.shipping_method
  return m === 'local_delivery' || m === 'local' ? 'Deliver' : 'Ship'
}

export default function FulfillmentPage() {
  const [adminKey, setAdminKey] = useState('')
  const [authed, setAuthed]     = useState(false)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('active')   // 'active' | 'attention' | 'in-progress' | 'done' | 'all'
  const [savingIds, setSavingIds] = useState(new Set())

  const pollRef = useRef(null)

  const fetchOrders = useCallback(async (key) => {
    try {
      const res = await fetch(`/api/admin/fulfillment/orders?key=${encodeURIComponent(key)}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setOrders(data.orders || [])
      setError('')
    } catch (e) {
      setError(`Refresh failed: ${e.message}`)
    }
  }, [])

  // Auto-login from sessionStorage (same key as the existing /admin page)
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? sessionStorage.getItem('forge-admin-key') : ''
    if (saved) {
      setAdminKey(saved)
      setAuthed(true)
    }
  }, [])

  // Initial load + polling every 5 seconds for near-real-time multi-user sync
  useEffect(() => {
    if (!authed || !adminKey) return
    setLoading(true)
    fetchOrders(adminKey).finally(() => setLoading(false))
    pollRef.current = setInterval(() => fetchOrders(adminKey), 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [authed, adminKey, fetchOrders])

  async function handleLogin(e) {
    e.preventDefault()
    setLoginError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/fulfillment/orders?key=${encodeURIComponent(password)}`)
      if (!res.ok) {
        setLoginError(res.status === 401 ? 'Invalid password' : `Error ${res.status}`)
        setLoading(false)
        return
      }
      sessionStorage.setItem('forge-admin-key', password)
      setAdminKey(password)
      setAuthed(true)
    } catch {
      setLoginError('Failed to connect')
    }
    setLoading(false)
  }

  function handleLogout() {
    sessionStorage.removeItem('forge-admin-key')
    setAdminKey('')
    setAuthed(false)
    setOrders([])
  }

  // Optimistic update + persist
  async function patchOrder(orderId, patch) {
    // Optimistic local state
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...patch } : o))
    setSavingIds(prev => new Set(prev).add(orderId))
    try {
      const res = await fetch(`/api/admin/fulfillment/update?key=${encodeURIComponent(adminKey)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, ...patch }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      const j = await res.json()
      // Reconcile with server response (timestamps, etc.)
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...j.order } : o))
    } catch (e) {
      setError(`Save failed: ${e.message}`)
      // Re-fetch to recover from any client/server divergence
      fetchOrders(adminKey)
    } finally {
      setSavingIds(prev => { const n = new Set(prev); n.delete(orderId); return n })
    }
  }

  // ── Login screen ──────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen bg-[#0d1b2a] flex items-center justify-center px-4">
        <div className="bg-white rounded-xl p-8 w-full max-w-sm shadow-2xl">
          <div className="text-center mb-6">
            <p className="font-bold text-xl tracking-widest text-[#0d1b2a]">FORGE AMINO</p>
            <p className="text-xs text-gray-400 tracking-widest mt-1">FULFILLMENT</p>
          </div>
          <form onSubmit={handleLogin}>
            <input type="password" placeholder="Admin password"
              value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm mb-3 focus:outline-none focus:border-[#2196f3]" />
            {loginError && <p className="text-red-500 text-xs mb-3">{loginError}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-[#0d1b2a] text-white py-3 rounded-lg font-bold tracking-widest uppercase text-sm hover:bg-[#1a2e45] transition-colors disabled:opacity-50">
              {loading ? 'Loading…' : 'Enter'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── Filters + counts ──────────────────────────────────────────────────────
  const counts = orders.reduce((acc, o) => {
    const done = o.payment_status === 'paid' && (o.fulfillment_status === 'shipped' || o.fulfillment_status === 'delivered')
    if (done) acc.done++
    else if (o.claimed_by) acc.inProgress++
    else acc.attention++
    if (isActive(o)) acc.active++
    return acc
  }, { active: 0, attention: 0, inProgress: 0, done: 0 })

  const filtered = orders.filter(o => {
    const done = o.payment_status === 'paid' && (o.fulfillment_status === 'shipped' || o.fulfillment_status === 'delivered')
    if (filter === 'active')      return isActive(o)
    if (filter === 'attention')   return !done && !o.claimed_by
    if (filter === 'in-progress') return !done && !!o.claimed_by
    if (filter === 'done')        return done
    return true
  })

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-[#0d1b2a] tracking-wide">Fulfillment</h1>
          <p className="text-xs text-gray-400 mt-1">
            {orders.length} orders (last 60 days) · auto-refreshes every 5s
          </p>
        </div>
        <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600">Sign out</button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 text-xs text-red-700">{error}</div>
      )}

      {/* Filter chips with counts */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          ['active',      `Active (${counts.active})`],
          ['attention',   `Needs claim (${counts.attention})`],
          ['in-progress', `In progress (${counts.inProgress})`],
          ['done',        `Done (${counts.done})`],
          ['all',         `All`],
        ].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-3 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-colors
              ${filter === val ? 'bg-[#0d1b2a] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Orders table */}
      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-left">
              <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Date</th>
              <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Order</th>
              <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Customer</th>
              <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Items</th>
              <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide text-right">Total</th>
              <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Type</th>
              <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Aff.</th>
              <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Paid</th>
              <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Claimed by</th>
              <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Tracking #</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={11} className="text-center py-12 text-gray-400 text-sm">No orders match this filter</td></tr>
            )}
            {filtered.map(order => {
              const saving = savingIds.has(order.id)
              return (
                <tr key={order.id} className={`${rowTone(order)} border-b border-gray-100 ${saving ? 'opacity-70' : ''}`}>
                  <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 font-bold text-[#0d1b2a] whitespace-nowrap">{order.order_number}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-[#0d1b2a]">{order.customer_name}</p>
                    <p className="text-[11px] text-gray-500">
                      {order.customer_phone || ''}
                      {order.shipping_address?.state ? ` · ${order.shipping_address.state}` : ''}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700 max-w-[260px]">{summarizeItems(order.line_items)}</td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">${Number(order.total).toFixed(2)}</td>
                  <td className="px-3 py-2 text-xs">{deliverOrShip(order)}</td>
                  <td className="px-3 py-2 text-xs font-bold">{order.affiliate_code || ''}</td>
                  <td className="px-3 py-2">
                    <select
                      value={order.payment_status || 'pending'}
                      onChange={e => patchOrder(order.id, { payment_status: e.target.value })}
                      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-[#2196f3]"
                    >
                      {PAYMENT_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={order.claimed_by || ''}
                      onChange={e => patchOrder(order.id, { claimed_by: e.target.value || null })}
                      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-[#2196f3]"
                    >
                      <option value="">— unclaimed —</option>
                      {STAFF.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={order.fulfillment_status || 'pending'}
                      onChange={e => patchOrder(order.id, { fulfillment_status: e.target.value })}
                      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-[#2196f3]"
                    >
                      {FULFILLMENT_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      defaultValue={order.tracking_number || ''}
                      onBlur={e => {
                        const v = e.target.value.trim()
                        if (v !== (order.tracking_number || '')) {
                          patchOrder(order.id, { tracking_number: v })
                        }
                      }}
                      placeholder="—"
                      className="text-xs border border-gray-200 rounded px-2 py-1 w-32 bg-white focus:outline-none focus:border-[#2196f3]"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile note + legend */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-gray-500">
        <div className="bg-pink-50 rounded-lg p-3">
          <strong className="text-[#0d1b2a]">Pink</strong> · Needs someone to claim
        </div>
        <div className="bg-yellow-50 rounded-lg p-3">
          <strong className="text-[#0d1b2a]">Yellow</strong> · Claimed, in progress
        </div>
        <div className="bg-green-50 rounded-lg p-3">
          <strong className="text-[#0d1b2a]">Green</strong> · Paid + shipped or delivered
        </div>
      </div>
    </div>
  )
}
