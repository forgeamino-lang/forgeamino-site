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
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 bg-gray-50 rounded overflow-hidden">
                {item.image ? (
                  <Image src={item.image} alt={item.name} fill className="object-contain p-1" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#0d1b2a] via-[#15263d] to-[#0d1b2a]">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c9a227" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/>
                      <line x1="8.5" y1="2" x2="15.5" y2="2"/>
                      <line x1="7" y1="16" x2="17" y2="16"/>
                    </svg>
                  </div>
                )}
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
        <div className="flex justify-between items-center mb-5">
          <span className="font-bold text-[#0d1b2a] text-lg">Order Total</span>
          <span className="font-bold text-[#0d1b2a] text-2xl">${cartTotal.toFixed(2)}</span>
        </div>

        {/* Shipping info */}
        {cartTotal >= 250 ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-5">
            <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-1">🎉 Free Shipping Unlocked!</p>
            <p className="text-xs text-green-700">Your order qualifies for free shipping.</p>
            <p className="text-xs text-green-600 mt-1">Ships via <span className="font-semibold">FedEx 2-Day</span> to the United States.</p>
          </div>
        ) : (
          <div className="bg-[#f8f9fa] border border-gray-200 rounded-lg p-4 mb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-[#0d1b2a] uppercase tracking-wide">📦 Free Shipping on $250+</p>
              <p className="text-xs font-semibold text-[#2196f3]">${(250 - cartTotal).toFixed(2)} away</p>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
              <div
                className="bg-[#2196f3] h-1.5 rounded-full transition-all"
                style={{ width: `${Math.min((cartTotal / 250) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">All orders ship via <span className="font-semibold">FedEx 2-Day</span> to the United States.</p>
          </div>
        )}

        {/* Payment preview */}
        <div className="bg-[#f0f7ff] rounded-lg p-4 mb-6 border border-[#2196f3]/20">
          <p className="text-xs font-bold text-[#0d1b2a] mb-1">💳 Payment via Venmo</p>
          <p className="text-xs text-gray-600">
            After checkout, payment instructions will be emailed to you immediately with everything you need to complete your order.
          </p>
        </div>
{/* ── CUSTOM REQUEST BANNER ── */}
        <div className="bg-[#f0f7ff] border border-[#2196f3]/30 rounded-lg p-4 mb-6 flex items-start gap-3">
                    <span className="text-lg flex-shrink-0">💬</span>
                    <p className="text-sm text-[#0d1b2a]">
                      <span className="font-bold">Don&apos;t see a product you&apos;re interested in?</span>{' '}
                      We&apos;re happy to help source it —{' '}
            <Link href="/contact" className="text-[#2196f3] font-bold hover:underline">contact us →</Link>
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
