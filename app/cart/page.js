'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCart } from '../../components/CartContext'
import { Trash2, Plus, Minus } from 'lucide-react'

export default function CartPage() {
  const { cart, removeItem, updateQuantity, cartTotal } = useCart()

  if (cart.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <h1 className="text-2xl font-bold text-[#0d1b2a] mb-4 tracking-wide">Your Cart is Empty</h1>
        <p className="text-gray-500 mb-8">Add some products to get started.</p>
        <Link href="/shop" className="inline-block bg-[#0d1b2a] text-white px-8 py-3 rounded-full font-bold tracking-widest uppercase text-sm hover:bg-[#1a2e45] transition-colors">
          Browse Products
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="text-2xl font-bold text-[#0d1b2a] mb-6 sm:mb-8 tracking-wide uppercase">Your Cart</h1>

      <div className="space-y-3 mb-8">
        {cart.map(item => (
          <div key={item.slug} className="bg-white rounded-lg p-3 sm:p-4 shadow-sm">
            <div className="flex items-center gap-3">
              {/* Image */}
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 bg-gray-50 rounded">
                <Image src={item.image} alt={item.name} fill className="object-contain p-1" />
              </div>

              {/* Name + price */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#0d1b2a] text-xs sm:text-sm uppercase tracking-wide leading-snug mb-0.5">{item.name}</p>
                <p className="text-gray-500 text-xs sm:text-sm">${item.price.toFixed(2)} each</p>
              </div>

              {/* Remove */}
              <button
                onClick={() => removeItem(item.slug)}
                className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
              >
                <Trash2 size={16} />
              </button>
            </div>

            {/* Qty controls + line total on second row */}
            <div className="flex items-center justify-between mt-3 pl-[76px] sm:pl-[92px]">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQuantity(item.slug, item.quantity - 1)}
                  className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors"
                >
                  <Minus size={12} />
                </button>
                <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.slug, item.quantity + 1)}
                  className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors"
                >
                  <Plus size={12} />
                </button>
              </div>
              <p className="font-bold text-[#0d1b2a] text-sm">${(item.price * item.quantity).toFixed(2)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Order total */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <span className="font-bold text-[#0d1b2a] text-lg">Order Total</span>
          <span className="font-bold text-[#0d1b2a] text-2xl">${cartTotal.toFixed(2)}</span>
        </div>

        {/* Payment preview */}
        <div className="bg-[#f0f7ff] rounded-lg p-4 mb-6 border border-[#2196f3]/20">
          <p className="text-xs font-bold text-[#0d1b2a] mb-1">💳 Payment via Venmo</p>
          <p className="text-xs text-gray-600">
            After checkout, payment instructions will be emailed to you immediately with everything you need to complete your order.
          </p>
        </div>

        <Link
          href="/checkout"
          className="block w-full text-center bg-[#0d1b2a] text-white py-4 rounded-full font-bold tracking-widest uppercase text-sm hover:bg-[#1a2e45] transition-colors"
        >
          Proceed to Checkout
        </Link>
        <Link
          href="/shop"
          className="block w-full text-center text-gray-500 py-3 text-sm hover:text-[#0d1b2a] transition-colors mt-2"
        >
          ← Continue Shopping
        </Link>
      </div>
    </div>
  )
}
