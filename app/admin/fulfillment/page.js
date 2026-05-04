'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

const STAFF = ['Angela', 'Mark', 'Sean']
const FULFILLMENT_STATES = ['pending', 'processing', 'shipped', 'delivered']
const PAYMENT_STATES     = ['pending', 'paid', 'failed']
const POLL_INTERVAL_MS   = 10000   // 10s, was 5s — lower race surface against PATCH writes

function isActive(o)   { return o.fulfillment_status !== 'delivered' }
function isDone(o)     { return o.payment_status === 'paid' &&
                                (o.fulfillment_status === 'shipped' || o.fulfillment_status === 'delivered') }
function rowTone(o)    { if (isDone(o)) return 'bg-green-50'
                         if (o.claimed_by) return 'bg-yellow-50'
                         return 'bg-pink-50' }
function summarizeItems(line_items) {
  if (!Array.isArray(line_items)) return ''
  return line_items.map(li => `${li.quantity}× ${li.name}`).join(', ')
}
function deliverOrShip(o) {
  const m = o.shipping_address?.shipping_method
  return m === 'local_delivery' || m === 'local' ? 'Deliver' : 'Ship'
}

export default function FulfillmentPage() {
  const [adminKey, setAdminKey]  = useState('')
  const [authed, setAuthed]      = useState(false)
  const [password, setPassword]  = useState('')
  const [loginError, setLoginError] = useState('')

  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [filter, setFilter]   = useState('active')
  const [savingIds, setSavingIds] = useState(new Set())

  // Mirror of savingIds + adminKey for callbacks that fire outside the React
  // render cycle (the polling interval). Avoids stale-closure bugs without
  // having to bake them into the useCallback deps (which would restart polling
  // on every save and itself cause races).
  const savingIdsRef = useRef(new Set())
  const adminKeyRef  = useRef('')
  useEffect(() => { savingIdsRef.current = savingIds }, [savingIds])
  useEffect(() => { adminKeyRef.current  = adminKey  }, [adminKey])

  const pollRef = useRef(null)

  // Polling fetch.
  // - Skips entirely when any save is in flight (no chance of clobbering an
  //   in-flight optimistic update with stale server data).
  // - Even on a clean merge, any row currently being saved keeps its local
  //   version (defense in depth, in case savingIds flipped between the GET
  //   firing and the response landing).
  const fetchOrders = useCallback(async ({ force = false } = {}) => {
    if (!force && savingIdsRef.current.size > 0) return  // skip while saving
    const key = adminKeyRef.current
    if (!key) return
    try {
      const res = await fetch(`/api/admin/fulfillment/orders?key=${encodeURIComponent(key)}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const fetched = data.orders || []
      setOrders(prev => {
        if (savingIdsRef.current.size === 0) return fetched
        const prevById = new Map(prev.map(o => [o.id, o]))
        return fetched.map(o =>
          savingIdsRef.current.has(o.id) ? (prevById.get(o.id) || o) : o
        )
      })
      setError('')
    } catch (e) {
      setError(`Refresh failed: ${e.message}`)
    }
  }, [])

  // Auto-login from sessionStorage (matches /admin convention)
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? sessionStorage.getItem('forge-admin-key') : ''
    if (saved) {
      setAdminKey(saved)
      setAuthed(true)
    }
  }, [])

  // Initial load + 10s polling
  useEffect(() => {
    if (!authed || !adminKey) return
    setLoading(true)
    fetchOrders({ force: true }).finally(() => setLoading(false))
    pollRef.current = setInterval(() => fetchOrders(), POLL_INTERVAL_MS)
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
        setLoading(false); return
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
    setAdminKey(''); setAuthed(false); setOrders([])
  }

  // Update flow: optimistic local set → PATCH → reconcile with server response
  // (or revert + show error). savingIds keeps the polling loop hands-off until
  // the round trip completes, so the optimistic value can't get clobbered.
  async function patchOrder(orderId, patch) {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...patch } : o))
    setSavingIds(prev => { const n = new Set(prev); n.add(orderId); return n })
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
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...j.order } : o))
      setError('')
    } catch (e) {
      setError(`Save failed: ${e.message} — try again`)
      // Force a refresh so we know the true server state, but only AFTER we
      // remove from savingIds (handled in finally below)
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

  // Counts + filtering
  const counts = orders.reduce((acc, o) => {
    if (isDone(o)) acc.done++
    else if (o.claimed_by) acc.inProgress++
    else acc.attention++
    if (isActive(o)) acc.active++
    return acc
  }, { active: 0, attention: 0, inProgress: 0, done: 0 })

  const filtered = orders.filter(o => {
    if (filter === 'active')      return isActive(o)
    if (filter === 'attention')   return !isDone(o) && !o.claimed_by
    if (filter === 'in-progress') return !isDone(o) && !!o.claimed_by
    if (filter === 'done')        return isDone(o)
    return true
  })

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-[#0d1b2a] tracking-wide">Fulfillment</h1>
          <p className="text-xs text-gray-400 mt-1">
            {orders.length} orders (last 60 days) · auto-refreshes every 10s
          </p>
        </div>
        <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600">Sign out</button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 text-xs text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => { setError(''); fetchOrders({ force: true }) }}
            className="ml-3 text-red-700 underline font-bold">Refresh</button>
        </div>
      )}

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

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-left">
              {/* Claimed By is the first column now — fastest action a user takes when they land on the page */}
              <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Claimed by</th>
              <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Date</th>
              <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Order</th>
              <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Customer</th>
              <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Items</th>
              <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide text-right">Total</th>
              <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Type</th>
              <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Aff.</th>
              <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Paid</th>
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
                  <td className="px-3 py-2">
                    <select
                      value={order.claimed_by || ''}
                      onChange={e => patchOrder(order.id, { claimed_by: e.target.value || null })}
                      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-[#2196f3] font-bold"
                    >
                      <option value="">— unclaimed —</option>
                      {STAFF.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </td>
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
