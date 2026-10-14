'use client'

import { useState } from 'react'
import { useCart } from '../../../../components/CartContext'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { BULK_TIERS, isBulkEligible } from '../../../../lib/bulkDiscount'

const money = n => `$${n.toFixed(2)}`

export default function AddToCartButton({ product }) {
  const { addItem } = useCart()
  const router = useRouter()
  const [qty, setQty] = useState(1)

  const eligible = isBulkEligible(product)
  const isBottle = ['capsules', 'tablets'].includes(product.category) || /tablet|capsule/i.test(product.name)
  const unit = n => (isBottle ? (n === 1 ? 'Bottle' : 'Bottles') : (n === 1 ? 'Vial' : 'Vials'))

  // Single unit first, then the multi-vial tiers smallest → largest.
  const options = [
    { qty: 1, pct: 0, badge: null },
    ...[...BULK_TIERS].reverse().map(t => ({ qty: t.minQty, pct: t.pct, badge: t.badge })),
  ]

  function handleAdd() {
    addItem({
      id: product.id,
      slug: product.slug,
      name: product.name,
      qbo_name: product.qbo_name || product.name,
      price: product.price,
      image: product.image,
    }, qty)
    toast.success(qty > 1 ? `${qty} × ${product.name} added to cart` : `${product.name} added to cart`, {
      style: { background: '#0d1b2a', color: '#fff' },
      iconTheme: { primary: '#4fc3f7', secondary: '#0d1b2a' },
    })
  }

  if (!product.inStock || product.price === 0 || product.comingSoon) {
    return (
      <button disabled className="w-full py-4 bg-gray-200 text-gray-400 rounded-full font-bold tracking-widest uppercase text-sm cursor-not-allowed">
        {product.comingSoon || product.price === 0 ? 'Coming Soon' : 'Out of Stock'}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {eligible && (
        <div className="mb-1">
          <p className="text-xs font-bold text-[#0d1b2a] uppercase tracking-widest mb-2">Bundle &amp; Save</p>
          <div className="space-y-2" role="radiogroup" aria-label="Choose quantity">
            {options.map(o => {
              const each = Math.round(product.price * (1 - o.pct) * 100) / 100
              const save = Math.round(product.price * o.qty * o.pct * 100) / 100
              const selected = qty === o.qty
              return (
                <button
                  key={o.qty}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setQty(o.qty)}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border-2 text-left transition-colors ${
                    selected ? 'border-[#2196f3] bg-[#f0f7ff]' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${selected ? 'border-[#2196f3] bg-[#2196f3] shadow-[inset_0_0_0_3px_#fff]' : 'border-gray-300'}`} />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-[#0d1b2a]">{o.qty} {unit(o.qty)}</span>
                        {o.badge && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#0d1b2a] text-white">{o.badge}</span>
                        )}
                        {o.pct > 0 && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-green-100 text-green-700">{Math.round(o.pct * 100)}% Off</span>
                        )}
                      </span>
                      {o.pct > 0 && (
                        <span className="block text-xs text-green-700 mt-0.5">Save {money(save)}</span>
                      )}
                    </span>
                  </span>
                  <span className="text-right flex-shrink-0">
                    <span className="block text-sm font-bold text-[#0d1b2a]">{money(each)}<span className="text-xs font-normal text-gray-500"> / {unit(1).toLowerCase()}</span></span>
                    {o.qty > 1 && (
                      <span className="block text-xs text-gray-500">{money(each * o.qty)} total</span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="text-[11px] text-gray-500 leading-relaxed mt-2">
            Applies automatically at checkout for 5+ or 10+ of this item. The multi-vial discount
            can&apos;t be combined with discount codes. You&apos;ll always get whichever saves you more.
          </p>
        </div>
      )}

      <button
        onClick={handleAdd}
        className="w-full py-4 bg-[#0d1b2a] text-white rounded-full font-bold tracking-widest uppercase text-sm hover:bg-[#1a2e45] transition-colors active:scale-95"
      >
        {qty > 1 ? `Add ${qty} to Cart` : 'Add to Cart'}
      </button>
      <button
        onClick={() => { handleAdd(); router.push('/checkout') }}
        className="w-full py-4 bg-[#4fc3f7] text-[#0d1b2a] rounded-full font-bold tracking-widest uppercase text-sm hover:bg-[#2196f3] hover:text-white transition-colors active:scale-95"
      >
        Buy Now
      </button>
    </div>
  )
}
