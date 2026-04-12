'use client'

import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'
import { useCart } from './CartContext'

export default function Header() {
  const { cartCount } = useCart()

  return (
    <>
      {/* Announcement bar — top of page, matches forgeamino.com */}
      <div className="bg-[#b3e5fc] text-[#0d1b2a] text-center py-2 text-xs font-semibold tracking-wide">
        Use code FORGE100 at checkout — payment instructions will be emailed to you
      </div>

      <header className="bg-white text-[#0d1b2a] sticky top-0 z-50 shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 relative">
              <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                <path d="M20 3 L35 11 L35 29 L20 37 L5 29 L5 11 Z" fill="none" stroke="#2196f3" strokeWidth="2"/>
                <path d="M20 9 L30 15 L30 25 L20 31 L10 25 L10 15 Z" fill="#2196f3" opacity="0.15"/>
                <path d="M15 20 L18 17 L22 17 L25 20 L22 23 L18 23 Z" fill="#2196f3"/>
              </svg>
            </div>
            <div>
              <div className="font-bold text-lg tracking-widest leading-none text-[#2196f3]">FORGE</div>
              <div className="text-[#0d1b2a] text-xs tracking-widest leading-none">AMINO</div>
            </div>
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-10">
            <Link href="/shop" className="text-sm tracking-widest font-semibold text-[#0d1b2a] hover:text-[#2196f3] transition-colors uppercase">
              Shop
            </Link>
            <Link href="/contact" className="text-sm tracking-widest font-semibold text-[#0d1b2a] hover:text-[#2196f3] transition-colors uppercase">
              Contact
            </Link>
          </nav>

          {/* Cart icon */}
          <Link href="/cart" className="relative flex items-center gap-2 text-[#0d1b2a] hover:text-[#2196f3] transition-colors">
            <ShoppingCart size={22} />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-[#2196f3] text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </header>
    </>
  )
}
