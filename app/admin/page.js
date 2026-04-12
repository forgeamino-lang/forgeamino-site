'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-gray-100 text-gray-800',
}

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/orders?key=${encodeURIComponent(password)}`)
      if (!res.ok) { setError('Invalid password'); setLoading(false); return }
      const data = await res.json()
      sessionStorage.setItem('forge-admin-key', password)
      setOrders(data.orders)
      setAuthed(true)
    } catch {
      setError('Failed to connect')
    }
    setLoading(false)
  }

  useEffect(() => {
    const saved = sessionStorage.getItem('forge-admin-key')
    if (saved) {
      setPassword(saved)
      fetch(`/api/orders?key=${encodeURIComponent(saved)}`)
        .then(r => r.json())
        .then(d => { if (d.orders) { setOrders(d.orders); setAuthed(true) } })
    }
  }, [])

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#0d1b2a] flex items-center justify-center px-4">
        <div className="bg-white rounded-xl p-8 w-full max-w-sm shadow-2xl">
          <div className="text-center mb-6">
            <p className="font-bold text-xl tracking-widest text-[#0d1b2a]">FORGE AMINO</p>
            <p className="text-xs text-gray-400 tracking-widest mt-1">ADMIN PANEL</p>
          </div>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              placeholder="Admin password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm mb-3 focus:outline-none focus:border-[#2196f3]"
            />
            {error && <p className="text-red-500 text-xs mb-3">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-[#0d1b2a] text-white py-3 rounded-lg font-bold tracking-widest uppercase text-sm hover:bg-[#1a2e45] transition-colors">
              {loading ? 'Loading…' : 'Enter'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  const filteredOrders = filter === 'all' ? orders : orders.filter(o =>
    filter === 'pending-payment' ? o.payment_status === 'pending' :
    filter === 'paid' ? o.payment_status === 'paid' :
    filter === 'shipped' ? o.fulfillment_status === 'shipped' : true
  )

  const stats = {
    pendingPayment: orders.filter(o => o.payment_status === 'pending').length,
    paid: orders.filter(o => o.payment_status === 'paid').length,
    totalRevenue: orders.filter(o => o.payment_status === 'paid').reduce((s, o) => s + o.total, 0),
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-[#0d1b2a] tracking-wide">Orders Dashboard</h1>
          <p className="text-xs text-gray-400 mt-1">{orders.length} total orders</p>
        </div>
        <button onClick={() => { setAuthed(false); sessionStorage.removeItem('forge-admin-key') }}
          className="text-xs text-gray-400 hover:text-gray-600">Sign out</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Pending Payment</p>
          <p className="text-3xl font-bold text-yellow-600">{stats.pendingPayment}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Paid Orders</p>
          <p className="text-3xl font-bold text-green-600">{stats.paid}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Revenue (Paid)</p>
          <p className="text-3xl font-bold text-[#0d1b2a]">${stats.totalRevenue.toFixed(0)}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[['all','All Orders'],['pending-payment','Pending Payment'],['paid','Paid'],['shipped','Shipped']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-colors
              ${filter === val ? 'bg-[#0d1b2a] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Orders table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Order</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Customer</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Total</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Payment</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Fulfillment</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Date</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 && (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400 text-sm">No orders found</td></tr>
            )}
            {filteredOrders.map(order => (
              <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-bold text-sm text-[#0d1b2a]">{order.order_number}</td>
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-[#0d1b2a]">{order.customer_name}</p>
                  <p className="text-xs text-gray-400">{order.customer_email}</p>
                </td>
                <td className="px-4 py-3 font-bold text-sm">${order.total.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wide ${STATUS_COLORS[order.payment_status] || 'bg-gray-100 text-gray-600'}`}>
                    {order.payment_status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wide ${STATUS_COLORS[order.fulfillment_status] || 'bg-gray-100 text-gray-600'}`}>
                    {order.fulfillment_status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {new Date(order.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/orders/${order.id}`}
                    className="text-xs text-[#2196f3] font-bold hover:underline">
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
