'use client'

import Image from 'next/image'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useCart } from './CartContext'
import { getProductBySlug } from '../lib/products'
import { suggestForProduct, suggestForCart } from '../lib/pairings'

// "Stacks well with" on a product page (mode="product", pass slug) or
// "Commonly researched together" in the cart (mode="cart"). Rules live in
// lib/pairings.js.

const money = n => `$${Number(n).toFixed(2)}`

function Thumb({ image, name }) {
  return (
    <div className="relative w-14 h-14 flex-shrink-0 bg-gray-50 rounded overflow-hidden">
      {image ? (
        <Image src={image} alt={name} fill sizes="56px" className="object-contain p-1" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d1b2a] via-[#15263d] to-[#0d1b2a]" />
      )}
    </div>
  )
}

export default function PairingSuggestions({ mode = 'product', slug }) {
  const { cart, addItem } = useCart()
  const cartSlugs = cart.map(i => i.slug)

  const { upgrade, items } = mode === 'cart'
    ? suggestForCart(cartSlugs, 2)
    : { upgrade: null, items: suggestForProduct(slug, cartSlugs, 3) }

  if (!items.length && !upgrade) return null

  function add(s) {
    const p = getProductBySlug(s.slug)
    if (!p) return
    addItem({ id: p.id, slug: p.slug, name: p.name, qbo_name: p.qbo_name || p.name, price: p.price, image: p.image }, 1)
    toast.success(`${p.name} added to cart`, {
      style: { background: '#0d1b2a', color: '#fff' },
      iconTheme: { primary: '#4fc3f7', secondary: '#0d1b2a' },
    })
  }

  const title = mode === 'cart' ? 'Commonly researched together' : 'Stacks well with'

  return (
    <section aria-label={title} className={mode === 'cart' ? 'mb-8' : 'mt-6'}>
      {upgrade && (
        <div className="mb-3 rounded-lg border border-[#2196f3]/30 bg-[#f0f7ff] p-4 flex items-center gap-3">
          <Thumb image={upgrade.image} name={upgrade.name} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-[#0d1b2a] uppercase tracking-wide">Save {money(upgrade.saves)} per pair</p>
            <p className="text-xs text-gray-600 leading-snug">
              BPC-157 and TB-500 are also available together in one vial: {upgrade.name}, {money(upgrade.price)} vs {money(upgrade.separate)} separately.
            </p>
          </div>
          <Link href={`/shop/p/${upgrade.slug}`} className="text-xs font-bold text-[#2196f3] whitespace-nowrap hover:underline">View</Link>
        </div>
      )}
      {items.length > 0 && (
        <>
          <h2 className="text-xs font-bold text-[#0d1b2a] uppercase tracking-widest mb-3">{title}</h2>
          <ul className="grid gap-2">
            {items.map(s => (
              <li key={s.slug} className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3">
                <Thumb image={s.image} name={s.name} />
                <Link href={`/shop/p/${s.slug}`} className="flex-1 min-w-0 group">
                  <p className="text-xs sm:text-sm font-bold text-[#0d1b2a] uppercase tracking-wide leading-snug group-hover:text-[#2196f3]">{s.name}</p>
                  <p className="text-xs text-gray-500">{money(s.price)}</p>
                </Link>
                <button
                  type="button"
                  onClick={() => add(s)}
                  aria-label={`Add ${s.name} to cart`}
                  className="text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full border-2 border-[#0d1b2a] text-[#0d1b2a] hover:bg-[#0d1b2a] hover:text-white transition-colors whitespace-nowrap"
                >
                  + Add
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
