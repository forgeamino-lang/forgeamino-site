'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

const PAGE_VERSION = 'v11 · 2026-05-04 20:20 (stay logged in)'

// 12 months back from now, plus current. Used to populate the Month dropdown.
function buildMonthOptions() {
  const out = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const value = d.toISOString().slice(0, 7) // YYYY-MM
    const label = d.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    out.push({ value, label })
  }
  return out
}
const MONTH_OPTIONS = buildMonthOptions()
const CURRENT_MONTH = MONTH_OPTIONS[0].value
const STAFF = ['Angela', 'Mark', 'Sean']
const FULFILLMENT_STATES = ['pending', 'processing', 'shipped', 'delivered']
const PAYMENT_STATES     = ['pending', 'paid', 'failed']
const POLL_INTERVAL_MS   = 30000   // 30s — generous, polls only catch peer edits

// Browser PushManager wants the public VAPID key as a Uint8Array
function urlBase64ToUint8Array(b64) {
  const padding = '='.repeat((4 - b64.length % 4) % 4)
  const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}
const SAVE_COOLDOWN_MS   = 5000    // skip polling for 5s after any local save

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
  const [adminKey, setAdminKey]   = useState('')
  const [authed, setAuthed]       = useState(false)
  const [password, setPassword]   = useState('')
  const [loginError, setLoginError] = useState('')

  const [orders, setOrders]       = useState([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [filter, setFilter]       = useState('active')
  const [savingIds, setSavingIds] = useState(new Set())
  const [savedFlash, setSavedFlash] = useState(0)
  const [month, setMonth] = useState(CURRENT_MONTH)

  // ── Refs (synchronously updated, never stale) ────────────────────────────
  // Anything the polling callback or async PATCH path needs to read MUST go
  // through a ref — useState values would be stale by the time the callback
  // fires several seconds later.
  const adminKeyRef    = useRef('')
  const savingIdsRef   = useRef(new Set())
  const lastSaveAtRef  = useRef(0)
  const pollRef        = useRef(null)

  useEffect(() => { adminKeyRef.current = adminKey }, [adminKey])
  const monthRef = useRef(CURRENT_MONTH)
  useEffect(() => { monthRef.current = month }, [month])
  // savingIds ref is updated SYNCHRONOUSLY inside patchOrder (not via effect),
  // so the polling skip check is immune to the React render cycle.

  // ── Polling fetch ────────────────────────────────────────────────────────
  // Skips entirely under three conditions to eliminate every race vector:
  //   1) any save is in flight (savingIdsRef non-empty)
  //   2) we just saved within SAVE_COOLDOWN_MS (covers the brief window after
  //      a save where the GET response could carry pre-PATCH data)
  //   3) no admin key
  // Even when polling DOES proceed, rows whose ids are in savingIds keep
  // their local version (defense in depth).
  const fetchOrders = useCallback(async ({ force = false } = {}) => {
    const key = adminKeyRef.current
    if (!key) return
    if (!force) {
      if (savingIdsRef.current.size > 0) return
      if (Date.now() - lastSaveAtRef.current < SAVE_COOLDOWN_MS) return
    }
    try {
      const res = await fetch(`/api/admin/fulfillment/orders?key=${encodeURIComponent(key)}&month=${monthRef.current}&_=${Date.now()}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const fetched = data.orders || []
      // Diagnostic: log the first 3 orders' key fields so Sean can see in
      // DevTools if a polling response ever returns stale data
      console.log('[fetchOrders] got', fetched.length, 'orders. first 3:',
        fetched.slice(0, 3).map(o => ({ ord: o.order_number, claim: o.claimed_by, paid: o.payment_status, ful: o.fulfillment_status })))
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

  // ── Push notification state ──────────────────────────────────────────────
  const [pushUser, setPushUser]         = useState('')
  const [pushStatus, setPushStatus]     = useState('idle')   // idle | subscribing | subscribed | denied | unsupported | error
  const [pushSub, setPushSub]           = useState(null)
  const [pushUiOpen, setPushUiOpen]     = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushStatus('unsupported'); return
    }
    if (Notification.permission === 'denied') { setPushStatus('denied'); return }
    // Restore prior selected user from local storage
    const savedUser = localStorage.getItem('forge-push-user')
    if (savedUser) setPushUser(savedUser)
    // Detect existing subscription (returning visit)
    navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription())
      .then(sub => {
        if (sub) { setPushSub(sub); setPushStatus('subscribed') }
      }).catch(() => {})
  }, [])

  async function handleEnableNotifications() {
    if (!pushUser) { setError('Pick a user (Angela / Mark / Sean) first'); return }
    setPushStatus('subscribing'); setError('')
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setPushStatus(perm === 'denied' ? 'denied' : 'idle'); return }
      const reg = await navigator.serviceWorker.ready
      const vapidPubKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidPubKey) {
        setError('Server is missing NEXT_PUBLIC_VAPID_PUBLIC_KEY env var')
        setPushStatus('error'); return
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPubKey),
      })
      const res = await fetch(`/api/admin/fulfillment/subscribe?key=${encodeURIComponent(adminKeyRef.current)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_name: pushUser,
          subscription: sub.toJSON(),
          user_agent: navigator.userAgent,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      localStorage.setItem('forge-push-user', pushUser)
      setPushSub(sub); setPushStatus('subscribed')
    } catch (e) {
      console.error(e); setError(`Notifications setup failed: ${e.message}`); setPushStatus('error')
    }
  }

  async function handleDisableNotifications() {
    try {
      if (pushSub) {
        await fetch(`/api/admin/fulfillment/subscribe?key=${encodeURIComponent(adminKeyRef.current)}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: pushSub.endpoint }),
        })
        await pushSub.unsubscribe()
      }
      setPushSub(null); setPushStatus('idle')
    } catch (e) {
      setError(`Couldn't disable: ${e.message}`)
    }
  }

  // ── Auto-login from sessionStorage ───────────────────────────────────────
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('forge-admin-key') : ''
    if (saved) {
      setAdminKey(saved)
      setAuthed(true)
    }
  }, [])

  // ── Register PWA service worker on mount ─────────────────────────────────
  // SW only handles push notifications now — no fetch interception at all.
  // When the SW switches versions and posts back 'sw-activated', force a page
  // reload so any previously-cached state from the old fetch-intercepting SW
  // is flushed.
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/admin/' })
      .catch(err => console.warn('SW registration failed:', err))
    let reloaded = false
    function onMessage(e) {
      if (e.data?.type === 'sw-activated' && !reloaded) {
        reloaded = true
        // Small delay so React can settle, then hard-reload
        setTimeout(() => window.location.reload(), 250)
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [])

  // ── Initial load + polling. Re-runs (and clears the interval) when month
  //    changes so the new selection takes effect immediately. ──────────────
  useEffect(() => {
    if (!authed || !adminKey) return
    setLoading(true)
    fetchOrders({ force: true }).finally(() => setLoading(false))
    pollRef.current = setInterval(() => fetchOrders(), POLL_INTERVAL_MS)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [authed, adminKey, fetchOrders, month])

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
      localStorage.setItem('forge-admin-key', password)
      setAdminKey(password); setAuthed(true)
    } catch { setLoginError('Failed to connect') }
    setLoading(false)
  }
  function handleLogout() {
    localStorage.removeItem('forge-admin-key')
    setAdminKey(''); setAuthed(false); setOrders([])
  }

  // ── Update flow: optimistic → PATCH → reconcile ─────────────────────────
  async function patchOrder(orderId, patch) {
    // Update ref SYNCHRONOUSLY (before any state set / await) so the next
    // polling check, even if it fires the same tick, sees an in-flight save.
    const nextSet = new Set(savingIdsRef.current); nextSet.add(orderId)
    savingIdsRef.current = nextSet
    setSavingIds(nextSet)

    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...patch } : o))

    try {
      const res = await fetch(`/api/admin/fulfillment/update?key=${encodeURIComponent(adminKeyRef.current)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, ...patch }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      const j = await res.json()
      console.log('[patchOrder]', orderId.slice(0, 8), 'sent:', patch, '← got back:', j.order)
      // Stamp the cooldown BEFORE removing from savingIds, so even if polling
      // fires immediately on the savingIds-cleared render it still sees the
      // cooldown window and skips.
      lastSaveAtRef.current = Date.now()
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...j.order } : o))
      setError('')
      setSavedFlash(Date.now())  // brief visual feedback
    } catch (e) {
      setError(`Save failed: ${e.message} — try again`)
    } finally {
      const after = new Set(savingIdsRef.current); after.delete(orderId)
      savingIdsRef.current = after
      setSavingIds(after)
    }
  }

  // ── Login screen ─────────────────────────────────────────────────────────
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

  // Counts + filter
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

  const showSavedToast = savedFlash > 0 && Date.now() - savedFlash < 1500

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-[#0d1b2a] tracking-wide">Fulfillment</h1>
          <p className="text-xs text-gray-400 mt-1">
            {orders.length} orders in {MONTH_OPTIONS.find(o => o.value === month)?.label || month} · syncs every 30s · {PAGE_VERSION}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {showSavedToast && (
            <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded">Saved ✓</span>
          )}
          <button onClick={() => fetchOrders({ force: true })}
            className="text-xs text-gray-500 hover:text-[#0d1b2a] underline">Refresh</button>
          <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600">Sign out</button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 text-xs text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => { setError(''); fetchOrders({ force: true }) }}
            className="ml-3 text-red-700 underline font-bold">Refresh</button>
        </div>
      )}

      {/* Push notifications — collapsible row */}
      <div className="bg-white rounded-lg shadow-sm p-3 mb-3">
        <button
          onClick={() => setPushUiOpen(o => !o)}
          className="flex items-center justify-between w-full text-left text-xs"
        >
          <span className="font-bold text-[#0d1b2a] uppercase tracking-wide">
            Notifications on this device:&nbsp;
            <span className={
              pushStatus === 'subscribed' ? 'text-green-600' :
              pushStatus === 'denied'     ? 'text-red-600'   :
              pushStatus === 'unsupported'? 'text-gray-400'  :
              'text-yellow-700'
            }>
              {pushStatus === 'subscribed' ? `On (${pushUser})` :
               pushStatus === 'denied'     ? 'Blocked by browser' :
               pushStatus === 'unsupported'? 'Not supported here' :
               pushStatus === 'subscribing'? 'Setting up…' :
               'Off'}
            </span>
          </span>
          <span className="text-gray-400">{pushUiOpen ? '▴' : '▾'}</span>
        </button>

        {pushUiOpen && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-3">
            {pushStatus === 'subscribed' ? (
              <>
                <span className="text-xs text-gray-600">
                  This device will buzz when a new order comes in. Subscribed as <strong>{pushUser}</strong>.
                </span>
                <button onClick={handleDisableNotifications}
                  className="text-xs font-bold uppercase tracking-wide bg-gray-100 hover:bg-gray-200 text-[#0d1b2a] px-3 py-2 rounded-full">
                  Turn off
                </button>
              </>
            ) : pushStatus === 'denied' ? (
              <span className="text-xs text-red-700">
                Notifications are blocked for this site in your browser settings. Re-enable them in your browser's site settings, then come back and try again.
              </span>
            ) : pushStatus === 'unsupported' ? (
              <span className="text-xs text-gray-500">
                This browser doesn't support web push. iPhones need the page <em>installed as an app</em> via Add to Home Screen — open in Safari and install first.
              </span>
            ) : (
              <>
                <label className="text-xs text-gray-500">I am:</label>
                <select
                  value={pushUser}
                  onChange={e => setPushUser(e.target.value)}
                  className="text-sm font-bold border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-[#2196f3]"
                >
                  <option value="">— pick —</option>
                  {STAFF.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <button
                  onClick={handleEnableNotifications}
                  disabled={!pushUser || pushStatus === 'subscribing'}
                  className="text-xs font-bold uppercase tracking-wide bg-[#0d1b2a] hover:bg-[#1a2e45] text-white px-3 py-2 rounded-full disabled:opacity-50"
                >
                  {pushStatus === 'subscribing' ? 'Setting up…' : 'Enable Notifications'}
                </button>
                <span className="text-xs text-gray-400">
                  Your phone/laptop will buzz the moment a new order is placed.
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Month picker — narrows the working set to a single calendar month */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Month:</label>
        <select
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="text-sm font-bold border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-[#2196f3]"
        >
          {MONTH_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

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
