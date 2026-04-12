'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ShoppingCart } from 'lucide-react'
import { useCart } from './CartContext'

export default function Header() {
  const { cartCount } = useCart()

  return (
    <>
      <header className="bg-white text-[#0d1b2a] sticky top-0 z-50 shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
            <Image
              src="/forge-amino-logo.png"
              alt="Forge Amino"
              width={160}
              height={44}
              className="h-11 w-auto"
              priority
            />
          </Link>

          {/* Nav + Cart grouped in top right */}
          <div className="flex items-center gap-8">
            <nav className="hidden md:flex items-center gap-8">
              <Link href="/shop" className="text-sm tracking-widest font-semibold text-[#0d1b2a] hover:text-[#2196f3] transition-colors uppercase">
                Shop
              </Link>
              <Link href="/contact" className="text-sm tracking-widest font-semibold text-[#0d1b2a] hover:text-[#2196f3] transition-colors uppercase">
                Contact
              </Link>
            </nav>
            <Link href="/cart" className="relative flex items-center text-[#0d1b2a] hover:text-[#2196f3] transition-colors">
              <ShoppingCart size={22} />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-[#2196f3] text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>
    </>
  )
}
