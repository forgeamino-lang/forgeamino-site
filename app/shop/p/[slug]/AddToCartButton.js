'use client'

import { useState } from 'react'
import { useCart } from '../../../../components/CartContext'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { BULK_TIERS, isBulkEligible, bulkTierFor, nextBulkTier } from '../../../../lib/bulkDiscount'
import QuantityStepper from '../../../../components/QuantityStepper'

const money = n => `$${n.toFixed(2)}`

export default function AddToCartButton({ product }) {
  const { addItem } = useCart()
  const router = useRouter()
  const [qty, setQty] = useState(1)

  const eligible = isBulkEligible(product)
  const isBottle = ['capsules', 'tablets'].includes(product.category) || /tablet|capsule/i.test(product.name)
  const unit = n => (isBottle ? (n === 1 ? 'Bottle' : 'Bottles') : (n === 1 ? 'Vial' : 'Vials'))
  const unitsLower = isBottle ? 'bottles' : 'vials'

  // Price brackets: 1–4 (single price), 5–9 (20% off), 10+ (30% off).
  const ascending = [...BULK_TIERS].reverse()
  const brackets = [
    { min: 1, max: ascending[0].minQty - 1, pct: 0, badge: null },
    ...ascending.map((t, i) => ({ min: t.minQty, max: ascending[i + 1] ? ascending[i + 1].minQty - 1 : null, pct: t.pct, badge: t.badge })),
  ]
  const activeTier = eligible ? bulkTierFor(qty) : null
  const activePct = activeTier ? activeTier.pct : 0
  const each = Math.round(product.price * (1 - activePct) * 100) / 100
  const lineTotal = Math.round(each * qty * 100) / 100
  const saved = Math.round((product.price * qty - lineTotal) * 100) / 100
  const next = eligible ? nextBulkTier(product, qty) : null

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
        <div>
          <p className="text-xs font-bold text-[#0d1b2a] uppercase tracking-widest mb-2">Bundle &amp; Save</p>
          <div className="space-y-2" role="radiogroup" aria-label="Quantity pricing">
            {brackets.map(b => {
              const bEach = Math.round(product.price * (1 - b.pct) * 100) / 100
              const selected = qty >= b.min && (b.max === null || qty <= b.max)
              const label = b.max === null ? `${b.min}+ ${unit(2)}` : (b.min === b.max ? `${b.min} ${unit(b.min)}` : `${b.min}–${b.max} ${unit(2)}`)
              return (
                <button
                  key={b.min}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => { if (!selected) setQty(b.min) }}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border-2 text-left transition-colors ${
                    selected ? 'border-[#2196f3] bg-[#f0f7ff]' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${selected ? 'border-[#2196f3] bg-[#2196f3] shadow-[inset_0_0_0_3px_#fff]' : 'border-gray-300'}`} />
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-[#0d1b2a]">{label}</span>
                      {b.badge && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#0d1b2a] text-white">{b.badge}</span>
                      )}
                      {b.pct > 0 && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-green-100 text-green-700">{Math.round(b.pct * 100)}% Off</span>
                      )}
                    </span>
                  </span>
                  <span className="text-sm font-bold text-[#0d1b2a] flex-shrink-0">
                    {money(bEach)}<span className="text-xs font-normal text-gray-500"> / {unit(1).toLowerCase()}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Free quantity selection — any number, priced by its bracket */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-[#0d1b2a] uppercase tracking-widest">Quantity</span>
          <QuantityStepper value={qty} onChange={setQty} />
        </div>
        <div className="text-right">
          <span className="block text-sm font-bold text-[#0d1b2a]">{money(lineTotal)}</span>
          {saved > 0 && <span className="block text-xs font-semibold text-green-700">You save {money(saved)}</span>}
        </div>
      </div>
      {eligible && (
        <p className="text-[11px] text-gray-500 leading-relaxed -mt-1">
          {next
            ? <>Add {next.needed} more {next.needed === 1 ? unit(1).toLowerCase() : unitsLower} for {Math.round(next.pct * 100)}% off. </>
            : null}
          The multi-vial discount applies automatically and can&apos;t be combined with discount codes.
          You&apos;ll always get whichever saves you more.
        </p>
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
