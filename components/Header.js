'use client'

import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'
import { useCart } from './CartContext'

export default function Header() {
  const { cartCount } = useCart()

  return (
    <header className="bg-[#0d1b2a] text-white sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <div className="w-9 h-9 relative">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <circle cx="20" cy="20" r="18" stroke="#4fc3f7" strokeWidth="2"/>
              <path d="M12 20 L20 10 L28 20 L20 30 Z" fill="#4fc3f7" opacity="0.8"/>
              <path d="M16 20 L20 14 L24 20 L20 26 Z" fill="#fff"/>
            </svg>
          </div>
          <div>
            <div className="font-bold text-lg tracking-widest leading-none">FORGE</div>
            <div className="text-[#4fc3f7] text-xs tracking-widest leading-none">AMINO</div>
          </div>
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-8">
          <Link href="/shop" className="text-sm tracking-widest font-medium hover:text-[#4fc3f7] transition-colors uppercase">
            Shop
          </Link>
          <Link href="/contact" className="text-sm tracking-widest font-medium hover:text-[#4fc3f7] transition-colors uppercase">
            Contact
          </Link>
        </nav>

        {/* Cart icon */}
        <Link href="/cart" className="relative flex items-center gap-2 hover:text-[#4fc3f7] transition-colors">
          <ShoppingCart size={22} />
          {cartCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-[#4fc3f7] text-[#0d1b2a] text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </Link>
      </div>

      {/* Announcement bar */}
      <div className="bg-[#4fc3f7] text-[#0d1b2a] text-center py-2 text-xs font-semibold tracking-wide">
        Use code FORGE100 at checkout — payment instructions will be emailed to you
      </div>
    </header>
  )
}
