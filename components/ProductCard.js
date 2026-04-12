'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCart } from './CartContext'
import { formatPrice } from '../lib/products'
import toast from 'react-hot-toast'

export default function ProductCard({ product }) {
  const { addItem } = useCart()

  function handleAddToCart(e) {
    e.preventDefault()
    if (!product.inStock || product.price === 0) return
    addItem({
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      image: product.image,
    })
    toast.success(`${product.name} added to cart`, {
      style: { background: '#0d1b2a', color: '#fff' },
      iconTheme: { primary: '#4fc3f7', secondary: '#0d1b2a' },
    })
  }

  return (
    <Link href={`/shop/p/${product.slug}`} className="group block">
      <div className="flex flex-col h-full">
        {/* Image container — fixed height for consistent grid alignment */}
        <div className="relative bg-white" style={{ height: '280px' }}>
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-contain p-4"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 400px"
          />
          {!product.inStock && (
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
          <p className="text-[#0d1b2a] font-medium text-sm mb-4">
            {formatPrice(product.price)}
          </p>
        </div>

        {/* Add to cart button */}
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
    </Link>
  )
}
