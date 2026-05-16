'use client'

import { useCart } from './CartContext'
import { formatPrice } from '../lib/products'
import toast from 'react-hot-toast'

// Card used on /lab for hidden products — no image, dark gradient with a
// gold flask icon and a "LAB" badge to clearly distinguish it from the
// standard catalog.  Lab items carry image: null in the cart, which cart
// and checkout render as a small flask icon fallback.
export default function LabProductCard({ product }) {
  const { addItem } = useCart()

  function handleAddToCart(e) {
    e.preventDefault()
    if (!product.inStock || product.price === 0) return
    addItem({
      id: product.id,
      slug: product.slug,
      name: product.name,
      qbo_name: product.qbo_name || product.name,
      price: product.price,
      image: null,
    })
    toast.success(`${product.name} added to cart`, {
      style: { background: '#0d1b2a', color: '#fff' },
      iconTheme: { primary: '#c9a227', secondary: '#0d1b2a' },
    })
  }

  return (
    <div className="group block">
      <div className="flex flex-col h-full">
        {/* Lab art block — no image */}
        <div className="relative bg-gradient-to-br from-[#0d1b2a] via-[#15263d] to-[#0d1b2a] rounded-lg h-[160px] sm:h-[220px] md:h-[280px] flex items-center justify-center overflow-hidden border border-[#c9a227]/20">
          {/* Hex pattern backdrop */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.08]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="hex-lab" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
                <polygon points="5,0 9.33,2.5 9.33,7.5 5,10 0.67,7.5 0.67,2.5" fill="none" stroke="#c9a227" strokeWidth="0.3"/>
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#hex-lab)"/>
          </svg>
          {/* Flask icon */}
          <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#c9a227" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="relative drop-shadow">
            <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/>
            <line x1="8.5" y1="2" x2="15.5" y2="2"/>
            <line x1="7" y1="16" x2="17" y2="16"/>
          </svg>
          {/* LAB badge */}
          <span className="absolute top-2 left-2 bg-[#c9a227] text-[#0d1b2a] text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest shadow">
            LAB
          </span>
          {!product.inStock && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="bg-white text-[#0d1b2a] text-xs font-bold px-3 py-1 rounded uppercase tracking-wider">
                Coming Soon
              </span>
            </div>
          )}
        </div>

        {/* Product info */}
        <div className="pt-4 pb-2 flex-1 flex flex-col">
          <h3 className="font-bold text-[#0d1b2a] text-sm tracking-wider uppercase leading-snug mb-2 min-h-[2.5rem]">
            {product.name}
          </h3>
          <p className="text-[#0d1b2a] font-medium text-sm mb-4">
            {formatPrice(product.price)}
          </p>

          {/* Certificate of Analysis (lab products have no detail page,
              so we surface batch COAs directly on the card). */}
          {product.coas && product.coas.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] font-bold text-[#0d1b2a] tracking-widest uppercase mb-1.5">
                Certificate of Analysis
              </p>
              <ul className="space-y-1">
                {product.coas.map((coa, i) => (
                  <li key={i}>
                    <a
                      href={coa.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 text-[11px] text-[#2196f3] hover:text-[#1565c0] hover:underline transition-colors font-medium"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                      {coa.text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Add to cart */}
        <button
          onClick={handleAddToCart}
          disabled={!product.inStock || product.price === 0}
          className={`w-full py-3 rounded-full text-xs font-bold tracking-widest uppercase transition-all
            ${product.inStock && product.price > 0
              ? 'bg-[#0d1b2a] text-white hover:bg-[#1a2e45] active:scale-95'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
        >
          {product.price === 0 ? 'Coming Soon' : product.inStock ? 'Add to Cart' : 'Out of Stock'}
        </button>
      </div>
    </div>
  )
}
