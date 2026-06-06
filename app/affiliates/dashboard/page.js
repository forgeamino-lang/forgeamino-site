import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { verifyToken, COOKIE_NAME } from '../../../lib/affiliate-auth'

export const dynamic = 'force-dynamic'

function money(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const pill = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800',
}

export default async function AffiliateDashboard() {
  const cookieStore = cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  const payload = token ? verifyToken(token) : null
  if (!payload) redirect('/affiliates')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const [{ data: orders }, { data: affiliate }] = await Promise.all([
    supabase
      .from('orders')
      .select('order_number, customer_name, customer_email, total, created_at, payment_status, fulfillment_status')
      .eq('affiliate_id', payload.affiliateId)
      .order('created_at', { ascending: false }),
    supabase
      .from('affiliates')
      .select('name, code, commission_rate')
      .eq('id', payload.affiliateId)
      .single(),
  ])

  const rows = orders || []
  const rate = Number(affiliate?.commission_rate || 0)
  const totalRevenue = rows.reduce((s, o) => s + Number(o.total || 0), 0)
  const totalCommission = totalRevenue * rate
  const uniqueCustomers = new Set(rows.map(o => o.customer_email?.toLowerCase())).size

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Forge Amino</p>
            <h1 className="text-lg font-bold text-gray-900">{affiliate?.name || payload.name} Affiliate Portal</h1>
          </div>
          <form method="post" action="/api/affiliate/logout">
            <button type="submit" className="text-sm text-gray-500 hover:text-gray-900 border border-gray-300 rounded-lg px-4 py-1.5 transition-colors">
              Sign Out
            </button>
          </form>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Orders', value: rows.length },
            { label: 'Revenue Driven', value: money(totalRevenue) },
            { label: 'Commission Earned', value: money(totalCommission) },
            { label: 'Unique Customers', value: uniqueCustomers },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400">Commission rate: {Math.round(rate * 100)}% on paid orders. Code: {affiliate?.code || payload.code}</p>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Orders</h2>
          </div>
          {rows.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-gray-400">No orders yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-6 py-3 text-left">Order</th>
                    <th className="px-6 py-3 text-left">Customer</th>
                    <th className="px-6 py-3 text-left">Date</th>
                    <th className="px-6 py-3 text-right">Total</th>
                    <th className="px-6 py-3 text-right">Commission</th>
                    <th className="px-6 py-3 text-left">Payment</th>
                    <th className="px-6 py-3 text-left">Fulfillment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map(o => (
                    <tr key={o.order_number} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-mono font-medium text-gray-900">{o.order_number}</td>
                      <td className="px-6 py-4 text-gray-600">{o.customer_name}</td>
                      <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{fmtDate(o.created_at)}</td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900">{money(o.total)}</td>
                      <td className="px-6 py-4 text-right text-green-700 font-medium">{money(Number(o.total) * rate)}</td>
                      <td className="px-6 py-4">
                        <span className={'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ' + (pill[o.payment_status] || 'bg-gray-100 text-gray-700')}>
                          {o.payment_status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ' + (pill[o.fulfillment_status] || 'bg-gray-100 text-gray-700')}>
                          {o.fulfillment_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
