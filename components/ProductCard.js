'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCart } from './CartContext'
import { formatPrice } from '../lib/products'
import toast from 'react-hot-toast'
import useHolidayOffer from './useHolidayOffer'
import { salePrice } from '../lib/offers'

export default function ProductCard({ product }) {
  const { addItem } = useCart()
  const { offer } = useHolidayOffer()

  function handleAddToCart(e) {
    e.preventDefault()
    if (!product.inStock || product.price === 0 || product.comingSoon) return
    addItem({
      id: product.id,
      slug: product.slug,
      name: product.name,
      qbo_name: product.qbo_name || product.name,
      price: product.price,
      image: product.image,
    })
    toast.success(`${product.name} added to cart`, {
      style: { background: '#0d1b2a', color: '#fff' },
      iconTheme: { primary: '#4fc3f7', secondary: '#0d1b2a' },
    })
  }

  const showComingSoon = !product.inStock || product.comingSoon
  // During a sale with a known % (offer_slide.discount_pct), show the price
  // with the code next to the regular price. Harvest theme adds a corner ribbon.
  const sale = !showComingSoon && offer?.code && offer.pct ? salePrice(product.price, offer.pct) : null
  const ribbon = sale && offer.tone === 'harvest'

  return (
    <Link href={`/shop/p/${product.slug}`} className="group block">
      <div className="flex flex-col h-full">
        {/* Image container — fixed height for consistent grid alignment */}
        <div className="relative bg-gray-50 rounded-lg h-[160px] sm:h-[220px] md:h-[280px]">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.name}
              fill
              className="object-contain p-4"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 400px"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-gray-300 text-xs uppercase tracking-widest">No Image</span>
            </div>
          )}
          {ribbon && (
            <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden rounded-tr-lg pointer-events-none" aria-hidden="true">
              <span className="absolute top-[18px] -right-[30px] w-[130px] rotate-45 bg-[#d9622b] text-white text-[10px] font-extrabold tracking-[0.12em] text-center py-1">
                {Math.round(offer.pct * 100)}% OFF
              </span>
            </div>
          )}
          {showComingSoon && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="bg-white text-[#0d1b2a] text-xs font-bold px-3 py-1 rounded uppercase tracking-wider">
                Coming Soon
              </span>
            </div>
          )}
        </div>

        {/* Product info */}
        <div className="pt-4 pb-2 flex-1 flex flex-col">
          <h3 className="font-bold text-[#0d1b2a] text-sm tracking-wider uppercase leading-snug mb-2 group-hover:text-[#2196f3] transition-colors min-h-[2.5rem]">
            {product.name}
          </h3>
          {sale ? (
            <p className="text-sm mb-4 flex flex-wrap items-baseline gap-x-2">
              <span className={`font-extrabold ${offer.tone === 'harvest' ? 'text-[#b8501f]' : 'text-[#B22234]'}`}>{formatPrice(sale)}</span>
              <span className="text-gray-500 line-through">{formatPrice(product.price)}</span>
              <span className="text-[11px] text-gray-500">with {offer.code}</span>
            </p>
          ) : (
            <p className="text-[#0d1b2a] font-medium text-sm mb-4">
              {formatPrice(product.price)}
            </p>
          )}
        </div>

        {/* Add to cart button */}
        <button
          onClick={handleAddToCart}
          disabled={!product.inStock || product.price === 0 || product.comingSoon}
          className={`w-full py-3 rounded-full text-xs font-bold tracking-widest uppercase transition-all
            ${product.inStock && product.price > 0 && !product.comingSoon
              ? 'bg-[#0d1b2a] text-white hover:bg-[#1a2e45] active:scale-95'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
        >
          {product.comingSoon || !product.inStock ? 'Coming Soon' : 'Add to Cart'}
        </button>
      </div>
    </Link>
  )
}
