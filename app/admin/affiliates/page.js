'use client'

import { useEffect, useState } from 'react'

export default function AffiliatesAdminPage() {
  const [adminKey, setAdminKey]   = useState('')
  const [authed, setAuthed]       = useState(false)
  const [password, setPassword]   = useState('')
  const [loginError, setLoginError] = useState('')

  const [rows, setRows]           = useState([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [flash, setFlash]         = useState('')
  const [filter, setFilter]       = useState('')

  // New / edit form
  const [editEmail, setEditEmail] = useState('')
  const [editCode,  setEditCode]  = useState('')
  const [editNotes, setEditNotes] = useState('')

  useEffect(() => {
    const stored = typeof window !== 'undefined' && window.localStorage.getItem('forge-admin-key')
    if (stored) {
      setAdminKey(stored); setAuthed(true)
    }
  }, [])

  async function handleLogin(e) {
    e?.preventDefault()
    if (!password) return
    try {
      const r = await fetch('/api/admin/affiliate-attributions?key=' + encodeURIComponent(password), { cache: 'no-store' })
      if (r.ok) {
        window.localStorage.setItem('forge-admin-key', password)
        setAdminKey(password); setAuthed(true); setLoginError('')
      } else {
        setLoginError('Wrong password')
      }
    } catch {
      setLoginError('Network error')
    }
  }
  function handleLogout() {
    window.localStorage.removeItem('forge-admin-key')
    setAdminKey(''); setAuthed(false); setPassword('')
  }

  async function fetchRows() {
    if (!adminKey) return
    setLoading(true); setError('')
    try {
      const r = await fetch('/api/admin/affiliate-attributions?key=' + encodeURIComponent(adminKey) + '&_=' + Date.now(), { cache: 'no-store' })
      const j = await r.json()
      if (!r.ok || !j.ok) throw new Error(j.error || 'fetch failed')
      setRows(j.attributions || [])
    } catch (e) {
      setError(e.message || 'unknown error')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { if (authed) fetchRows() }, [authed])

  async function saveOne() {
    if (!editEmail || !editCode) { setError('Email and code required'); return }
    setError(''); setFlash('')
    try {
      const r = await fetch('/api/admin/affiliate-attributions?key=' + encodeURIComponent(adminKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: editEmail, code: editCode, notes: editNotes || null }),
      })
      const j = await r.json()
      if (!r.ok || !j.ok) throw new Error(j.error || 'save failed')
      setFlash(`Saved: ${j.attribution.customer_email} → ${j.attribution.affiliate_code}`)
      setEditEmail(''); setEditCode(''); setEditNotes('')
      fetchRows()
    } catch (e) {
      setError(e.message)
    }
  }

  async function deleteRow(email) {
    if (!confirm(`Clear affiliate attribution for ${email}?  All future orders from this email will be unattributed (or pick up whatever code they next type).`)) return
    setError(''); setFlash('')
    try {
      const r = await fetch('/api/admin/affiliate-attributions?key=' + encodeURIComponent(adminKey) + '&email=' + encodeURIComponent(email), { method: 'DELETE' })
      const j = await r.json()
      if (!r.ok || !j.ok) throw new Error(j.error || 'delete failed')
      setFlash(`Cleared attribution for ${email}`)
      fetchRows()
    } catch (e) {
      setError(e.message)
    }
  }

  function startEdit(r) {
    setEditEmail(r.customer_email)
    setEditCode(r.affiliate_code)
    setEditNotes(r.notes || '')
    setFlash('')
  }

  const filtered = rows.filter(r => {
    if (!filter) return true
    const f = filter.toLowerCase()
    return (r.customer_email || '').includes(f) || (r.affiliate_code || '').toLowerCase().includes(f)
  })

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-white rounded-xl shadow p-6 w-full max-w-sm">
          <h1 className="text-xl font-bold text-[#0d1b2a] mb-4">Affiliate Attributions</h1>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Admin password"
            className="w-full border border-gray-200 rounded px-3 py-2 mb-3 focus:outline-none focus:border-[#2196f3]"
          />
          {loginError && <p className="text-red-500 text-xs mb-2">{loginError}</p>}
          <button type="submit" className="w-full bg-[#0d1b2a] text-white font-bold rounded px-3 py-2">Sign in</button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-baseline justify-between mb-4">
          <h1 className="text-2xl font-bold text-[#0d1b2a]">Affiliate Attributions</h1>
          <button onClick={handleLogout} className="text-xs text-gray-500 hover:text-gray-700">Sign out</button>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          First-touch sticky attribution by customer email. Once a customer is mapped here, every future order from that email
          carries the locked affiliate code regardless of what they type at checkout.
        </p>

        {/* Add / edit form */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <h2 className="text-sm font-bold text-[#0d1b2a] uppercase tracking-wide mb-3">Add or update mapping</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="email" placeholder="customer@example.com"
              value={editEmail} onChange={e => setEditEmail(e.target.value)}
              className="border border-gray-200 rounded px-3 py-2 focus:outline-none focus:border-[#2196f3]"
            />
            <input
              type="text" placeholder="MONTIE"
              value={editCode} onChange={e => setEditCode(e.target.value)}
              className="border border-gray-200 rounded px-3 py-2 focus:outline-none focus:border-[#2196f3]"
            />
            <input
              type="text" placeholder="Notes (optional)"
              value={editNotes} onChange={e => setEditNotes(e.target.value)}
              className="border border-gray-200 rounded px-3 py-2 focus:outline-none focus:border-[#2196f3]"
            />
            <button onClick={saveOne} className="bg-[#0d1b2a] text-white font-bold rounded px-3 py-2 hover:bg-black">
              Save
            </button>
          </div>
          {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
          {flash && <p className="text-green-700 text-xs mt-2">{flash}</p>}
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3 mb-3">
          <input
            type="text" placeholder="Filter by email or code…"
            value={filter} onChange={e => setFilter(e.target.value)}
            className="border border-gray-200 rounded px-3 py-2 text-sm w-72"
          />
          <button onClick={fetchRows} className="text-xs text-gray-500 hover:text-gray-700">
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <span className="text-xs text-gray-500 ml-auto">{rows.length} total · {filtered.length} shown</span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-left">
                <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Customer email</th>
                <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Code</th>
                <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">First attributed</th>
                <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">First order</th>
                <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Notes</th>
                <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-sm">
                  {loading ? 'Loading…' : 'No attributions yet — these get auto-created when customers use codes at checkout.'}
                </td></tr>
              )}
              {filtered.map(r => (
                <tr key={r.customer_email} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-[#0d1b2a] break-all">{r.customer_email}</td>
                  <td className="px-3 py-2 font-bold">{r.affiliate_code}</td>
                  <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                    {r.first_attributed_at ? new Date(r.first_attributed_at).toLocaleString() : ''}
                  </td>
                  <td className="px-3 py-2 text-xs">{r.first_order_number || ''}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{r.notes || ''}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button onClick={() => startEdit(r)} className="text-xs text-[#2196f3] hover:underline mr-3">Edit</button>
                    <button onClick={() => deleteRow(r.customer_email)} className="text-xs text-red-500 hover:underline">Clear</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
