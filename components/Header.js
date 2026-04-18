'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ShoppingCart, Menu, X } from 'lucide-react'
import { useCart } from './CartContext'
import { useState } from 'react'
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs'

export default function Header() {
    const { cartCount } = useCart()
    const [menuOpen, setMenuOpen] = useState(false)

  return (
        <>
          <header className="bg-white text-[#0d1b2a] sticky top-0 z-50 shadow-sm border-b border-gray-100">
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
  {/* Logo */}
              <Link href="/" className="flex items-center hover:opacity-80 transition-opacity" onClick={() => setMenuOpen(false)}>
            <Image src="/forge-amino-logo.png" alt="Forge Amino" width={160} height={44} className="h-11 w-auto" priority />
  </Link>

{/* Nav + Cart + Auth + Hamburger */}
          <div className="flex items-center gap-5">
                        <nav className="hidden md:flex items-center gap-8">
                          <Link href="/shop" className="text-sm tracking-widest font-semibold text-[#0d1b2a] hover:text-[#2196f3] transition-colors uppercase">
                            Shop
            </Link>
              <Link href="/lab" className="text-sm tracking-widest font-semibold text-[#0d1b2a] hover:text-[#2196f3] transition-colors uppercase">
                            Lab
            </Link>
              <Link href="/contact" className="text-sm tracking-widest font-semibold text-[#0d1b2a] hover:text-[#2196f3] transition-colors uppercase">
                            Contact
            </Link>
              <SignedOut>
                            <SignInButton mode="modal">
                              <button className="text-sm tracking-widest font-semibold text-[#0d1b2a] hover:text-[#2196f3] transition-colors uppercase">
                                Login
            </button>
            </SignInButton>
            </SignedOut>
              <SignedIn>
                            <Link href="/account" className="text-sm tracking-widest font-semibold text-[#0d1b2a] hover:text-[#2196f3] transition-colors uppercase">
                              My Account
            </Link>
            </SignedIn>
            </nav>

{/* Cart icon */}
            <Link href="/cart" className="relative flex items-center text-[#0d1b2a] hover:text-[#2196f3] transition-colors" onClick={() => setMenuOpen(false)}>
              <ShoppingCart size={22} />
            {cartCount > 0 && (
                              <span className="absolute -top-2 -right-2 bg-[#2196f3] text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {cartCount}
              </span>
              )}
</Link>

{/* UserButton avatar — desktop, signed in */}
            <SignedIn>
                            <div className="hidden md:block">
                              <UserButton afterSignOutUrl="/" />
              </div>
              </SignedIn>

{/* Hamburger — mobile only */}
            <button
              className="md:hidden flex items-center justify-center text-[#0d1b2a] hover:text-[#2196f3] transition-colors"
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
                </div>
                </div>

{/* Mobile nav dropdown */}
{menuOpen && (
            <div className="md:hidden bg-white border-t border-gray-100 px-6 py-2">
              <Link href="/shop" onClick={() => setMenuOpen(false)}
              className="block text-sm tracking-widest font-semibold text-[#0d1b2a] hover:text-[#2196f3] transition-colors uppercase py-3 border-b border-gray-50">
                              Shop
                </Link>
            <Link href="/lab" onClick={() => setMenuOpen(false)}
              className="block text-sm tracking-widest font-semibold text-[#0d1b2a] hover:text-[#2196f3] transition-colors uppercase py-3 border-b border-gray-50">
                              Lab
                </Link>
            <Link href="/contact" onClick={() => setMenuOpen(false)}
              className="block text-sm tracking-widests font-semibold text-[#0d1b2a] hover:text-[#2196f3] transition-colors uppercase py-3 border-b border-gray-50">
                              Contact
                </Link>
            <SignedOut>
                              <SignInButton mode="modal">
                                <button onClick={() => setMenuOpen(false)}
                  className="block w-full text-left text-sm tracking-widest font-semibold text-[#0d1b2a] hover:text-[#2196f3] transition-colors uppercase py-3 border-b border-gray-50">
                                      Login
                    </button>
                    </SignInButton>
                    </SignedOut>
            <SignedIn>
                                  <Link href="/account" onClick={() => setMenuOpen(false)}
                className="block text-sm tracking-widest font-semibold text-[#0d1b2a] hover:text-[#2196f3] transition-colors uppercase py-3 border-b border-gray-50">
                                  My Account
                  </Link>
              <div className="py-3 flex items-center gap-2">
                                  <UserButton afterSignOutUrl="/" />
                                  <span className="text-xs text-gray-500">Manage account</span>
                  </div>
                  </SignedIn>
                  </div>
        )}
</header>
          </>
  )
}
